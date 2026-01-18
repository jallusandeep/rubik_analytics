
import os
from app.core.config import settings

# Define paths relative to the main data directory
# Using a dedicated directory for scraper data like the user requested: data/scrapper/IPO/nse duckdb
# Note: User provided path "data/scrapper/IPO/nse duckdb", taking "nse_ipo.duckdb" as filename
IPO_DATA_DIR = os.path.join(settings.DATA_DIR, "scrapper", "IPO")
IPO_DB_PATH = os.path.join(IPO_DATA_DIR, "nse_ipo.duckdb")
BSE_IPO_DB_PATH = os.path.join(IPO_DATA_DIR, "bse_ipo.duckdb")
GMP_IPO_DB_PATH = os.path.join(IPO_DATA_DIR, "gmp_ipo.duckdb")

# Table Names
IPO_TABLE = "nse_ipos_raw"
BSE_TABLE = "bse_ipos_raw"
GMP_TABLE = "ipo_gmp_raw"

