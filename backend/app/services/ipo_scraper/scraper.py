
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import random
import logging
from .db import insert_ipo_data, ensure_schema

logger = logging.getLogger(__name__)

class NSEIPOScraper:
    def __init__(self):
        """Initialize the scraper with human-like browser settings"""
        self.url = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo"
        self.driver = None
        # We don't setup driver in init to allow on-demand run

    def setup_driver(self):
        """Configure Chrome driver to act like a human browser"""
        chrome_options = Options()

        # Reduce bot detection
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        # Human-like browser config
        chrome_options.add_argument('--start-maximized')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        # Headless for server environment
        chrome_options.add_argument('--headless=new')

        # Realistic user agent
        chrome_options.add_argument(
            'user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/131.0.0.0 Safari/537.36'
        )

        self.driver = webdriver.Chrome(options=chrome_options)

        # Hide webdriver flag
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
        """Add random delays to mimic human behavior"""
        time.sleep(random.uniform(min_seconds, max_seconds))

    def load_page(self):
        """Load the NSE IPO page with cookies"""
        logger.info("🌐 Loading NSE India IPO page...")

        # Optional warm-up to base domain
        try:
            self.driver.get("https://www.nseindia.com")
            self.human_like_delay(2, 4)
        except Exception:
            pass

        self.driver.get(self.url)
        self.human_like_delay(3, 5)

        try:
            WebDriverWait(self.driver, 20).until(
                EC.presence_of_element_located((By.ID, "tabs"))
            )
            logger.info("✓ Page loaded successfully")
        except TimeoutException:
            logger.warning("⚠ Warning: Page load timeout, attempting to continue...")

    def scrape_current_ipos(self):
        """Scrape data from CURRENT tab"""
        logger.info("📊 Scraping CURRENT IPOs...")

        try:
            # CURRENT tab id: Ipo_current
            current_tab = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "Ipo_current"))
            )
            current_tab.click()
            self.human_like_delay(2, 3)

            # Table id: publicIssuesCurrent
            table = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "publicIssuesCurrent"))
            )

            # "No Records" check within table
            try:
                table.find_element(By.XPATH, ".//td[contains(text(), 'No Records')]")
                logger.info("ℹ️  No current IPOs available")
                return []
            except NoSuchElementException:
                pass

            rows = table.find_elements(By.TAG_NAME, "tr")

            current_ipos = []
            for row in rows[1:]:  # skip header
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    # Live structure: 8 cells per row
                    if len(cells) >= 8:
                        ipo_data = {
                            "Type": "CURRENT",
                            "Company Name": cells[0].text.strip(),
                            "Security Type": cells[1].text.strip(),
                            "Issue Start Date": cells[2].text.strip(),
                            "Issue End Date": cells[3].text.strip(),
                            "Status": cells[4].text.strip(),
                            "Offered/Reserved": cells[5].text.strip(),
                            "Bids": cells[6].text.strip(),
                            "Subscription": cells[7].text.strip(),
                        }
                        current_ipos.append(ipo_data)
                except Exception:
                    continue

            logger.info(f"✓ Found {len(current_ipos)} Current IPO(s)")
            return current_ipos

        except Exception as e:
            logger.error(f"✗ Error scraping current IPOs: {e}")
            return []

    def scrape_upcoming_ipos(self):
        """Scrape data from UPCOMING ISSUES tab"""
        logger.info("📊 Scraping UPCOMING IPOs...")

        try:
            # UPCOMING tab id: ipo_upcoming_issue, container id: ipo-upcoming
            upcoming_tab = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "ipo_upcoming_issue"))
            )
            upcoming_tab.click()
            self.human_like_delay(2, 3)

            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//div[@id='ipo-upcoming']//table")
                )
            )

            container = self.driver.find_element(By.ID, "ipo-upcoming")

            # "No Records" check
            try:
                container.find_element(
                    By.XPATH, ".//td[contains(text(), 'No Records')]"
                )
                logger.info("ℹ️  No upcoming IPOs available")
                return []
            except NoSuchElementException:
                pass

            table = container.find_element(By.TAG_NAME, "table")
            rows = table.find_elements(By.TAG_NAME, "tr")

            upcoming_ipos = []
            for row in rows[1:]:
                try:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if len(cells) >= 7:
                        ipo_data = {
                            "Type": "UPCOMING",
                            "Security Type": cells[0].text.strip(),
                            "Company Name": cells[1].text.strip(),
                            "Symbol": cells[2].text.strip(),
                            "Issue Start Date": cells[3].text.strip(),
                            "Issue End Date": cells[4].text.strip(),
                            "Status": cells[5].text.strip(),
                            "Price Range": cells[6].text.strip(),
                            "Issue Size": cells[7].text.strip()
                            if len(cells) > 7
                            else "-",
                        }
                        upcoming_ipos.append(ipo_data)
                except Exception:
                    continue

            logger.info(f"✓ Found {len(upcoming_ipos)} Upcoming IPO(s)")
            return upcoming_ipos

        except Exception as e:
            logger.error(f"✗ Error scraping upcoming IPOs: {e}")
            return []

            if self.driver:
                self.driver.quit()

# Global status tracker
SCRAPER_STATUS = {
    "is_running": False,
    "current_step": "IDLE", # IDLE, INITIALIZING, LOADING, SCRAPING_CURRENT, SCRAPING_UPCOMING, SAVING, DONE, ERROR
    "last_updated": None
}

def update_status(step):
    SCRAPER_STATUS["current_step"] = step
    SCRAPER_STATUS["is_running"] = step not in ["IDLE", "DONE", "ERROR"]
    # We could add timestamp here

def get_scraper_status():
    return SCRAPER_STATUS

def run_scraper():
    update_status("INITIALIZING")
    try:
        scraper = NSEIPOScraper()
        
        update_status("LOADING")
        # Monkey patch load_page to update status? Or just update inside class?
        # Let's just update before calling methods since we control execution here
        # Actually modifying the class methods to call a callback or just updating here if we can breaking it down
        
        # Re-implement run logic here to control status updates or modify run method
        # Let's modify run method to take a status_callback? No, global is easiest for this script
        
        ensure_schema()
        scraper.setup_driver()
        
        scraper.load_page()

        update_status("SCRAPING_CURRENT")
        current_ipos = scraper.scrape_current_ipos()

        update_status("SCRAPING_UPCOMING")
        upcoming_ipos = scraper.scrape_upcoming_ipos()

        update_status("SAVING")
        # Save to DB
        if current_ipos:
            insert_ipo_data(current_ipos)
        if upcoming_ipos:
            insert_ipo_data(upcoming_ipos)

        update_status("DONE")
        return {
            "current": len(current_ipos),
            "upcoming": len(upcoming_ipos)
        }
    except Exception as e:
        logger.error(f"Scraper Failed: {e}")
        update_status("ERROR")
        return {"current": 0, "upcoming": 0}
    finally:
        # Reset to IDLE after a delay? Or just leave as DONE?
        # Leaving as DONE lets UI know it finished. UI can reset triggers.
        # But we need to allow next run. 
        # BackgroundTasks runs this. 
        # Let's set to IDLE after 5 seconds to allow UI to see DONE
        import time
        time.sleep(5)
        update_status("IDLE")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_scraper()
