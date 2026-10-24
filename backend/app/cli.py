"""
Management CLI for AICTE FDR Portal database operations.
Usage:
    python -m app.cli migrate    # Apply all pending database migrations
    python -m app.cli status     # Display applied and pending migration versions
    python -m app.cli seed       # Populate deterministic demo dataset
    python -m app.cli setup      # Migrate and seed fresh database in one command
"""

import sys
import argparse
from app.database import engine, get_db_context
from app.migrations.runner import apply_migrations, get_migration_status
from app.seeds import seed_database


def cmd_migrate(args):
    print("Running database migrations...")
    applied = apply_migrations(engine)
    if applied:
        print(f"Successfully applied {len(applied)} migration(s): {', '.join(applied)}")
    else:
        print("Schema is already up to date. No pending migrations.")


def cmd_status(args):
    status = get_migration_status(engine)
    print("=== Database Migration Status ===")
    print(f"Total available: {status['total_available']}")
    print(f"Applied:         {status['applied_count']} ({', '.join(status['applied_versions']) or 'None'})")
    print(f"Pending:         {status['pending_count']} ({', '.join(status['pending_versions']) or 'None'})")
    print(f"Status:          {'UP TO DATE' if status['is_up_to_date'] else 'MIGRATIONS PENDING'}")


def cmd_seed(args):
    print("Seeding database with deterministic demo data...")
    with get_db_context() as session:
        counts = seed_database(session)
    print("Seeding completed successfully:")
    for entity, count in counts.items():
        print(f"  - {entity.capitalize()}: {count}")


def cmd_setup(args):
    print("Setting up database (migrate + seed)...")
    cmd_migrate(args)
    cmd_seed(args)
    print("Setup completed successfully.")


def main():
    parser = argparse.ArgumentParser(description="AICTE FDR Portal Database Management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    subparsers.add_parser("migrate", help="Apply all pending migrations")
    subparsers.add_parser("status", help="Show migration status")
    subparsers.add_parser("seed", help="Seed database with deterministic demo data")
    subparsers.add_parser("setup", help="Run migrations and populate seed data")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "migrate": cmd_migrate,
        "status": cmd_status,
        "seed": cmd_seed,
        "setup": cmd_setup,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
