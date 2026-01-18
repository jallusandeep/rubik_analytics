from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from app.services.telegram_extractor.db import get_global_stats
from app.core.permissions import get_current_user
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

from app.services.news_ai.db import get_pipeline_backlog
from app.services.ipo_scraper.db import get_ipo_stats, get_bse_stats, get_gmp_stats, cleanup_old_data, get_ipo_data, get_bse_data, get_gmp_data
from app.services.scheduler import add_job, remove_job, get_job_status
from app.services.ipo_scraper.scraper import run_scraper
from app.services.ipo_scraper.bse_scraper import run_bse_scraper
from app.services.ipo_scraper.gmp_scraper import run_gmp_scraper

@router.get("/stats", response_model=dict)
def get_processor_stats(
    current_user: User = Depends(get_current_user)
):
    """
    Get global processing statistics for the News pipeline.
    """
    # Get Extraction Stats
    stats = get_global_stats()
    
    ipo_stats = get_ipo_stats()
    bse_stats = get_bse_stats()
    gmp_stats = get_gmp_stats()

    return {
        "ipo_current": ipo_stats.get("current", 0),
        "ipo_upcoming": ipo_stats.get("upcoming", 0),
        "bse_total": bse_stats.get("total", 0),
        "bse_open": bse_stats.get("open", 0),
        "gmp_total": gmp_stats.get("total", 0)
    }


# Scheduler Wrapper Functions
# Wrappers are synchronous so APScheduler runs them in a thread pool (preventing event loop blocking)
def scheduled_ipo_scraper():
    logger.info("Running Scheduled IPO Scraper")
    cleanup_old_data()
    run_scraper()

def scheduled_bse_scraper():
    logger.info("Running Scheduled BSE IPO Scraper")
    cleanup_old_data()
    run_bse_scraper()

def scheduled_gmp_scraper():
    logger.info("Running Scheduled GMP IPO Scraper")
    cleanup_old_data()
    run_gmp_scraper()


@router.post("/schedule")
async def set_schedule(
    request: dict, 
    # Payload examples:
    # Interval: { "type": "ipo", "schedule_type": "interval", "hours": 24 }
    # Cron:     { "type": "ipo", "schedule_type": "cron", "time": "14:30", "days": ["mon", "fri"] }
    current_user: User = Depends(get_current_user)
):
    logger.info(f"[SCHEDULER] Received schedule request: {request}")
    
    scraper_type = request.get("type")
    schedule_type = request.get("schedule_type", "interval")
    
    logger.info(f"[SCHEDULER] Scraper type: {scraper_type}, Schedule type: {schedule_type}")
    
    # Identify the job function
    if scraper_type == "ipo":
        func = scheduled_ipo_scraper
    elif scraper_type == "bse":
        func = scheduled_bse_scraper
    elif scraper_type == "gmp":
        func = scheduled_gmp_scraper
    else:
        logger.error(f"[SCHEDULER] Invalid scraper type: {scraper_type}")
        raise HTTPException(status_code=400, detail="Invalid scraper type")

    # Check if max schedules reached (limit to 5 per scraper)
    from app.services.scheduler import get_jobs_for_scraper, generate_job_id
    existing_jobs = get_jobs_for_scraper(scraper_type)
    if len(existing_jobs) >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 schedules allowed per scraper")

    # Generate unique job ID
    job_id = generate_job_id(scraper_type)
    logger.info(f"[SCHEDULER] Generated job ID: {job_id}")

    trigger_kwargs = {}
    
    if schedule_type == 'cron':
        time_str = request.get("time") # "HH:MM"
        if not time_str:
             raise HTTPException(status_code=400, detail="Time required for cron schedule")
        
        try:
            hour, minute = map(int, time_str.split(':'))
            trigger_kwargs['hour'] = hour
            trigger_kwargs['minute'] = minute
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

        days = request.get("days") # List of days e.g. ["mon", "tue"] or comma string
        if days:
            if isinstance(days, list):
                trigger_kwargs['day_of_week'] = ",".join(days)
            else:
                trigger_kwargs['day_of_week'] = days
        # If days is empty, it defaults to every day in CronTrigger
        
    else:
        # Interval default
        hours = request.get("hours")
        if not hours:
             # Fallback for legacy calls if any
             hours = 24
        trigger_kwargs['hours'] = int(hours)

    success = add_job(func, job_id, trigger_type=schedule_type, **trigger_kwargs)

    if success:
        msg = f"Scheduled {scraper_type} ({schedule_type}) as {job_id}"
        return {"status": "success", "message": msg, "job_id": job_id}
    else:
        raise HTTPException(status_code=500, detail="Failed to schedule job")

@router.delete("/schedule")
async def cancel_schedule(
    type: str, # "ipo" | "bse" | "gmp"
    job_id: str = None, # Optional: specific job ID to delete
    current_user: User = Depends(get_current_user)
):
    from app.services.scheduler import get_jobs_for_scraper, remove_all_jobs_for_scraper
    
    if job_id:
        # Delete specific job
        if remove_job(job_id):
            logger.info(f"[SCHEDULER] Cancelled specific job: {job_id}")
            return {"status": "success", "message": f"Cancelled schedule {job_id}"}
        else:
            raise HTTPException(status_code=404, detail="Schedule not found")
    else:
        # Delete all jobs for this scraper type
        count = remove_all_jobs_for_scraper(type)
        if count > 0:
            logger.info(f"[SCHEDULER] Cancelled {count} schedules for {type}")
            return {"status": "success", "message": f"Cancelled {count} schedule(s)", "count": count}
        else:
            raise HTTPException(status_code=404, detail="No schedules found")

@router.get("/schedule")
async def get_schedule_status(
    type: str,
    current_user: User = Depends(get_current_user)
):
     logger.info(f"[SCHEDULER] Get schedule status for type: {type}")
     
     if type not in ["ipo", "bse", "gmp"]:
          logger.error(f"[SCHEDULER] Invalid type for get_schedule: {type}")
          raise HTTPException(status_code=400, detail="Invalid scraper type")
     
     from app.services.scheduler import get_jobs_for_scraper
     jobs = get_jobs_for_scraper(type)
     
     if jobs:
         return {"status": "active", "schedules": jobs, "count": len(jobs)}
     else:
         return {"status": "inactive", "schedules": [], "count": 0}


from app.services.telegram_extractor.db import get_recent_extractions
from app.services.news_scoring.db import get_recent_scores
from app.services.news_ai.db import get_recent_enrichments

@router.get("/data/{table_type}")
def get_processor_data(
    table_type: str,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """
    Get data from a specific processor table.
    Supported types: 'ipo', 'bse-ipo', 'gmp-ipo'
    """
    if table_type == "ipo":
        return get_ipo_data(limit)
    elif table_type == "bse-ipo":
        return get_bse_data(limit)
    elif table_type == "gmp-ipo":
        return get_gmp_data(limit)
    else:
        # Default or error handling
        return []

@router.post("/ipo/run")
async def trigger_ipo_scraper(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Trigger the IPO scraper in the background.
    """
    # Cleanup old data first
    try:
        cleanup_old_data()
    except Exception as e:
        logger.error(f"Cleanup failed before IPO run: {e}")

    background_tasks.add_task(run_scraper)
    return {"status": "started", "message": "IPO Scraper started in background"}

@router.post("/bse-ipo/run")
async def trigger_bse_scraper(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Trigger the BSE IPO scraper in the background.
    """
    # Cleanup old data first
    try:
        cleanup_old_data()
    except Exception as e:
        logger.error(f"Cleanup failed before BSE IPO run: {e}")

    background_tasks.add_task(run_bse_scraper)
    return {"status": "started", "message": "BSE IPO Scraper started in background"}

@router.get("/ipo/status")
def get_ipo_scraper_status_endpoint(
    current_user: User = Depends(get_current_user)
):
    """
    Get the current status of the IPO scraper.
    """
    from app.services.ipo_scraper.scraper import get_scraper_status
    return get_scraper_status()

@router.get("/bse-ipo/status")
def get_bse_scraper_status_endpoint(
    current_user: User = Depends(get_current_user)
):
    """
    Get the current status of the BSE IPO scraper.
    """
    from app.services.ipo_scraper.bse_scraper import get_bse_scraper_status
    return get_bse_scraper_status()

# GMP IPO Scraper Endpoints
@router.post("/gmp-ipo/run")
def trigger_gmp_scraper(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Trigger the GMP IPO scraper in the background.
    """
    from app.services.ipo_scraper.gmp_scraper import run_gmp_scraper
    background_tasks.add_task(run_gmp_scraper)
    return {"status": "started", "message": "GMP IPO Scraper started in background"}

@router.get("/gmp-ipo/status")
def get_gmp_scraper_status_endpoint(
    current_user: User = Depends(get_current_user)
):
    from app.services.ipo_scraper.gmp_scraper import get_gmp_scraper_status
    return get_gmp_scraper_status()
