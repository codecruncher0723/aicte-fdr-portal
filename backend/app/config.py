import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Database configuration: defaults to SQLite for local standalone demo
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/aicte_fdr.db")
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", f"sqlite:///{BASE_DIR}/test_aicte_fdr.db")

# Document storage
STORAGE_DIR = os.getenv("STORAGE_DIR", str(BASE_DIR / "storage" / "documents"))
Path(STORAGE_DIR).mkdir(parents=True, exist_ok=True)

# Security & Session
SECRET_KEY = os.getenv("SECRET_KEY", "aicte_portal_dev_insecure_secret_key_change_in_prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8-hour shift demo session

# Duplicate FDR candidate detection scope configuration
# Canonical default: INSTITUTION_AND_BANK_AND_NUMBER (same institution + same bank + same FDR number)
# Additional supported scopes:
# - INSTITUTION_AND_NUMBER (same institution + same FDR number)
# - CROSS_INSTITUTION_BANK_AND_NUMBER (same bank + same FDR number across institutions)
# - EXACT_MATCH (same institution + bank + number + amount + issue_date)
# - GLOBAL_NUMBER (same FDR number across all institutions)
DUPLICATE_DETECTION_SCOPE = os.getenv("DUPLICATE_DETECTION_SCOPE", "INSTITUTION_AND_BANK_AND_NUMBER")
