#!/usr/bin/env python
"""
Top-level entry point for database management tasks.
Usage:
    python manage.py migrate
    python manage.py status
    python manage.py seed
    python manage.py setup
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.cli import main

if __name__ == "__main__":
    main()
