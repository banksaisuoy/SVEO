"""v10 Configuration"""
import os

# Pipeline settings
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "2"))
DAILY_QUOTA = int(os.environ.get("DAILY_QUOTA", "100"))
WAIT_PLAN_TIMEOUT = int(os.environ.get("WAIT_PLAN_TIMEOUT", "300"))
WAIT_SESSION_TIMEOUT = int(os.environ.get("WAIT_SESSION_TIMEOUT", "1800"))

# GitHub Actions
GH_OWNER = os.environ.get("GH_OWNER", "banksaisuoy")

# Timeouts
JULES_API_TIMEOUT = 30
GITHUB_API_TIMEOUT = 15
AI_API_TIMEOUT = 30

# Circuit breaker settings
CIRCUIT_OPEN_MINUTES = 360  # 6 hours
CIRCUIT_FAILURE_THRESHOLD = 3

# Cooldown
REPO_COOLDOWN_HOURS = 2

# Quality thresholds
PR_QUALITY_APPROVE_THRESHOLD = 70
PR_QUALITY_REJECT_THRESHOLD = 50

# Logging
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
