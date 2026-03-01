"""Unified migration CLI for turtle_album.

Use this script instead of calling `alembic upgrade head` directly when
bootstrapping old sqlite databases.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from alembic import command


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.alembic_manager import build_alembic_config, upgrade_or_bootstrap_schema


def main() -> None:
    parser = argparse.ArgumentParser(description="Database migration helper")
    subparsers = parser.add_subparsers(dest="action", required=True)

    upgrade_parser = subparsers.add_parser("upgrade", help="Upgrade schema")
    upgrade_parser.add_argument(
        "--revision",
        default="head",
        help="Target revision, default is head",
    )

    downgrade_parser = subparsers.add_parser("downgrade", help="Downgrade schema")
    downgrade_parser.add_argument("revision", help="Target revision, e.g. -1")

    revision_parser = subparsers.add_parser(
        "revision", help="Create a new migration revision"
    )
    revision_parser.add_argument("-m", "--message", required=True, help="Revision message")
    revision_parser.add_argument(
        "--autogenerate",
        action="store_true",
        help="Enable autogenerate based on model metadata",
    )

    subparsers.add_parser("current", help="Show current revision")
    subparsers.add_parser("history", help="Show revision history")

    args = parser.parse_args()
    config = build_alembic_config()

    if args.action == "upgrade":
        if args.revision == "head":
            mode = upgrade_or_bootstrap_schema()
            print(f"OK: upgraded schema to head ({mode})")
            return

        command.upgrade(config, args.revision)
        print(f"OK: upgraded schema to {args.revision}")
        return

    if args.action == "downgrade":
        command.downgrade(config, args.revision)
        print(f"OK: downgraded schema to {args.revision}")
        return

    if args.action == "revision":
        command.revision(config, message=args.message, autogenerate=args.autogenerate)
        print("OK: revision created")
        return

    if args.action == "current":
        command.current(config, verbose=True)
        return

    if args.action == "history":
        command.history(config, verbose=True)
        return

    raise RuntimeError(f"Unsupported action: {args.action}")


if __name__ == "__main__":
    main()
