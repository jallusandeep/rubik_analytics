from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import pandas as pd
import time
from datetime import datetime
import logging
from .db import ensure_gmp_schema, insert_gmp_data

logger = logging.getLogger(__name__)

# Global Status Tracking
GMP_SCRAPER_STATUS = {
    "is_running": False,
    "current_step": "IDLE", # INITIALIZING, LOADING, SCRAPING, SAVING, ERROR, DONE
    "last_run": None,
    "total_records": 0,
    "error": None
}

def update_gmp_status(step, error=None, records=0):
    GMP_SCRAPER_STATUS["current_step"] = step
    if error:
        GMP_SCRAPER_STATUS["error"] = str(error)
    if records > 0:
        GMP_SCRAPER_STATUS["total_records"] = records
    
    if step in ["DONE", "ERROR"]:
        GMP_SCRAPER_STATUS["is_running"] = False
        GMP_SCRAPER_STATUS["last_run"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_gmp_scraper_status():
    return GMP_SCRAPER_STATUS

class IPOGMPScraper:
    """
    IPOWatch GMP Scraper (Single Source)
    """

    def __init__(self, headless=True):
        self.chrome_options = Options()
        if headless:
            self.chrome_options.add_argument("--headless=new")
        self.chrome_options.add_argument("--no-sandbox")
        self.chrome_options.add_argument("--disable-dev-shm-usage")
        self.chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        self.chrome_options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        self.driver = None

    def start_driver(self):
        update_gmp_status("INITIALIZING")
        self.driver = webdriver.Chrome(options=self.chrome_options)
        self.driver.implicitly_wait(10)

    def close_driver(self):
        if self.driver:
            self.driver.quit()

    def clean_currency(self, value):
        if not value: return '0'
        # Handle ₹ symbol and commas
        val = value.replace('₹', '').replace(',', '').strip()
        # Handle null representations
        if val in ['-', '', 'N/A']:
            return '0'
        return val

    def clean_percentage(self, value):
        if not value: return '0'
        # Handle % symbol
        val = value.replace('%', '').strip()
        # Handle null representations
        if val in ['-', '', 'N/A']:
            return '0'
        return val

    def scrape_ipowatch(self):
        """
        Scrape IPO GMP data from IPOWatch.in
        """
        try:
            url = "https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/"
            update_gmp_status("LOADING")
            logger.info("Scraping IPOWatch...")

            self.driver.get(url)
            time.sleep(3)

            wait = WebDriverWait(self.driver, 15)
            table = wait.until(EC.presence_of_element_located((By.TAG_NAME, "table")))

            rows = table.find_elements(By.TAG_NAME, "tr")[1:]  # skip header

            records = []
            scraped_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            update_gmp_status("SCRAPING")
            for row in rows:
                cols = row.find_elements(By.TAG_NAME, "td")
                if len(cols) < 7:
                    continue

                # Raw values
                raw_gmp = cols[1].text.strip()
                raw_price = cols[2].text.strip()
                raw_gain = cols[3].text.strip()
                
                records.append({
                    "source": "ipowatch",
                    "ipo_name": cols[0].text.strip(),
                    "gmp": self.clean_currency(raw_gmp),
                    "ipo_price": self.clean_currency(raw_price),
                    "expected_listing_gain": self.clean_percentage(raw_gain),
                    "review": cols[4].text.strip(),
                    "gmp_updated_date": cols[5].text.strip(),
                    "ipo_type": cols[6].text.strip(),
                    "scraped_at": scraped_at
                })

            logger.info(f"IPOWatch rows scraped: {len(records)}")
            return records
            
        except Exception as e:
            logger.error(f"Error scraping IPOWatch: {e}")
            raise e

    def run(self):
        """
        Run scraper and save to DB
        """
        GMP_SCRAPER_STATUS["is_running"] = True
        GMP_SCRAPER_STATUS["error"] = None
        GMP_SCRAPER_STATUS["total_records"] = 0
        
        try:
            self.start_driver()
            records = self.scrape_ipowatch()
            
            if records:
                update_gmp_status("SAVING")
                ensure_gmp_schema()
                insert_gmp_data(records)
                update_gmp_status("DONE", records=len(records))
            else:
                update_gmp_status("DONE")
                logger.info("No data scraped.")
                
        except Exception as e:
            logger.error(f"GMP Scraper failed: {e}")
            update_gmp_status("ERROR", error=e)
        finally:
            self.close_driver()

def run_gmp_scraper():
    """
    Wrapper to run the scraper instance
    """
    if GMP_SCRAPER_STATUS["is_running"]:
        logger.info("GMP Scraper is already running.")
        return

    scraper = IPOGMPScraper(headless=True)
    scraper.run()
