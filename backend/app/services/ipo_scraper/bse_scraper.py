
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException
import time
import random
import logging
from .db import insert_bse_data, ensure_bse_schema

logger = logging.getLogger(__name__)

class BSEIPOScraper:
    def __init__(self):
        self.url = "https://www.bseindia.com/publicissue.html"
        self.driver = None

    def setup_driver(self):
        """Configure Chrome driver (same as NSE scraper)"""
        chrome_options = Options()
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        chrome_options.add_argument('--start-maximized')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--headless=new') # Headless for server

        chrome_options.add_argument(
            'user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/131.0.0.0 Safari/537.36'
        )

        self.driver = webdriver.Chrome(options=chrome_options)
        
        self.driver.execute_cdp_cmd(
            'Page.addScriptToEvaluateOnNewDocument',
            {
                'source': """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    })
                """
            },
        )
        self.driver.implicitly_wait(10)
        self.driver.set_page_load_timeout(60)

    def human_like_delay(self, min_seconds=1, max_seconds=3):
        time.sleep(random.uniform(min_seconds, max_seconds))

    def scrape_data(self):
        """Scrape BSE Public Issues/IPO data"""
        logger.info("🌐 Navigating to BSE Public Issues page...")
        try:
            self.driver.get(self.url)
            self.human_like_delay(3, 5)
            
            logger.info("⏳ Waiting for IPO table to load...")
            wait = WebDriverWait(self.driver, 20)
            
            # Wait for table
            table = wait.until(EC.presence_of_element_located(
                (By.XPATH, "//table[.//th[contains(text(), 'Security Name')]]")
            ))
            
            self.human_like_delay(1.5, 2.5)
            
            # Scroll to table
            self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", table)
            self.human_like_delay(1, 1.5)
            
            logger.info("📊 Extracting IPO data from table...")
            
            # Get rows (skipping header if possible or checking content)
            rows = self.driver.find_elements(By.XPATH, 
                "//table[.//th[contains(text(), 'Security Name')]]//tbody//tr | " +
                "//table[.//th[contains(text(), 'Security Name')]]//tr[td and .//a]"
            )
            
            logger.info(f"📝 Found {len(rows)} data rows to process")
            
            ipo_data = []
            
            for row in rows:
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if len(cells) < 8:
                        continue
                    
                    security_name = cells[0].text.strip()
                    exchange_platform = cells[1].text.strip()
                    start_date = cells[2].text.strip()
                    end_date = cells[3].text.strip()
                    offer_price = cells[4].text.strip()
                    face_value = cells[5].text.strip()
                    type_of_issue = cells[6].text.strip()
                    status = cells[7].text.strip()
                    
                    # Validation
                    if not security_name or 'Security Name' in security_name:
                        continue
                    
                    ipo_data.append({
                        'Security Name': security_name,
                        'Exchange Platform': exchange_platform,
                        'Start Date': start_date,
                        'End Date': end_date,
                        'Offer Price (₹)': offer_price,
                        'Face Value (₹)': face_value,
                        'Type of Issue': type_of_issue,
                        'Issue Status': status
                    })
                except StaleElementReferenceException:
                    continue
                except Exception:
                    continue
            
            logger.info(f"✓ Extracted {len(ipo_data)} BSE IPO records")
            return ipo_data

        except Exception as e:
            logger.error(f"Error scraping BSE: {e}")
            return []
        finally:
            if self.driver:
                self.driver.quit()

# Global Status
BSE_SCRAPER_STATUS = {
    "is_running": False,
    "current_step": "IDLE",
    "last_updated": None
}

def update_bse_status(step):
    BSE_SCRAPER_STATUS["current_step"] = step
    BSE_SCRAPER_STATUS["is_running"] = step not in ["IDLE", "DONE", "ERROR"]

def get_bse_scraper_status():
    return BSE_SCRAPER_STATUS

def run_bse_scraper():
    update_bse_status("INITIALIZING")
    try:
        scraper = BSEIPOScraper()
        
        update_bse_status("LOADING")
        ensure_bse_schema()
        scraper.setup_driver()
        
        update_bse_status("SCRAPING")
        data = scraper.scrape_data()
        
        update_bse_status("SAVING")
        if data:
            insert_bse_data(data)
            
        update_bse_status("DONE")
        
        # Reset to IDLE after delay
        import time
        time.sleep(5)
        update_bse_status("IDLE")
        
    except Exception as e:
        logger.error(f"BSE Scraper Failed: {e}")
        update_bse_status("ERROR")
