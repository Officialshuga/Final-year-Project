# ============================================================================
# FILE: run_absent_job.py
# PURPOSE: Standalone entry point for the END-OF-DAY cron job.
# ----------------------------------------------------------------------------
# Marks absentees for YESTERDAY (the last completed working day) by default,
# or for a date passed as the first argument.
#
# USAGE:
#   python run_absent_job.py                # process yesterday
#   python run_absent_job.py 2026-10-15     # process a specific date
#
# CRON EXAMPLE (run every day at 23:30, after shifts + grace have ended):
#   30 23 * * *  cd /path/to/backend && /path/to/venv/bin/python run_absent_job.py >> /var/log/gvu_absent.log 2>&1
#
# The job is idempotent, so running it more than once is safe.
# ============================================================================
import sys
from datetime import datetime, timedelta

from app import create_app
from app.absent_job.job import mark_absentees_for_date
from app.utils.clock import lagos_date


def main():
    app = create_app()
    with app.app_context():
        if len(sys.argv) > 1:
            target = datetime.strptime(sys.argv[1], "%Y-%m-%d").date()
        else:
            target = lagos_date() - timedelta(days=1)
        summary = mark_absentees_for_date(target)
        print(f"[absent-job] {summary}")


if __name__ == "__main__":
    main()
