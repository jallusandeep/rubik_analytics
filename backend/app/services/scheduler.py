import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.base import JobLookupError
import asyncio

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler()

def start_scheduler():
    """
    Starts the AsyncIOScheduler if not already running.
    """
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started.")

def stop_scheduler():
    """
    Shuts down the scheduler.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped.")

def add_job(func, job_id, trigger_type='interval', **kwargs):
    """
    Add a job to the scheduler.
    trigger_type: 'interval' or 'cron'
    kwargs: arguments for the trigger (e.g., hours=24 for interval, or hour=10, minute=30 for cron)
    """
    try:
        if trigger_type == 'cron':
            trigger = CronTrigger(**kwargs)
            trigger_info = f"cron: {kwargs}"
        else:
            # Default to interval
            trigger = IntervalTrigger(**kwargs)
            trigger_info = f"interval: {kwargs}"

        scheduler.add_job(
            func,
            trigger=trigger,
            id=job_id,
            replace_existing=True
        )
        logger.info(f"Job {job_id} added with {trigger_info}")
        return True
    except Exception as e:
        logger.error(f"Failed to add job {job_id}: {e}")
        return False

def remove_job(job_id):
    """
    Removes a job by ID.
    """
    try:
        scheduler.remove_job(job_id)
        logger.info(f"Job {job_id} removed.")
        return True
    except JobLookupError:
        logger.warning(f"Job {job_id} not found.")
        return False
    except Exception as e:
        logger.error(f"Failed to remove job {job_id}: {e}")
        return False

def get_job_status(job_id):
    """
    Returns details about a specific job.
    """
    job = scheduler.get_job(job_id)
    if job:
        return {
            "id": job.id,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "interval": str(job.trigger)
        }
    return None

def get_all_jobs():
    """
    Returns a list of all active jobs.
    """
    jobs = scheduler.get_jobs()
    return [
        {
            "id": job.id,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "interval": str(job.trigger)
        }
        for job in jobs
    ]

def get_jobs_for_scraper(scraper_type: str):
    """
    Get all jobs for a specific scraper type.
    Returns list of job details.
    """
    prefix = f"{scraper_type}_scraper_job"
    all_jobs = scheduler.get_jobs()
    matching_jobs = [job for job in all_jobs if job.id.startswith(prefix)]
    
    return [
        {
            "id": job.id,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        }
        for job in matching_jobs
    ]

def remove_all_jobs_for_scraper(scraper_type: str):
    """
    Remove all jobs for a specific scraper type.
    Returns count of removed jobs.
    """
    prefix = f"{scraper_type}_scraper_job"
    all_jobs = scheduler.get_jobs()
    matching_jobs = [job for job in all_jobs if job.id.startswith(prefix)]
    
    count = 0
    for job in matching_jobs:
        try:
            scheduler.remove_job(job.id)
            count += 1
            logger.info(f"Removed job {job.id}")
        except Exception as e:
            logger.error(f"Failed to remove job {job.id}: {e}")
    
    return count

def generate_job_id(scraper_type: str):
    """
    Generate a unique job ID for a scraper type.
    Format: {scraper_type}_scraper_job_{index}
    """
    existing_jobs = get_jobs_for_scraper(scraper_type)
    
    # Find the next available index
    existing_indices = []
    for job in existing_jobs:
        # Extract index from job_id like "ipo_scraper_job_1"
        parts = job["id"].split("_")
        if len(parts) >= 4 and parts[-1].isdigit():
            existing_indices.append(int(parts[-1]))
    
    next_index = 1
    while next_index in existing_indices:
        next_index += 1
    
    return f"{scraper_type}_scraper_job_{next_index}"
