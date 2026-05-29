"""Command-line entrypoint for 3 Mins Local.

Examples:
    python -m three_mins_local run                 # newest meeting -> newsletter
    python -m three_mins_local run --limit 3        # newest 3 meetings
    python -m three_mins_local run --print          # also print the issue
    python -m three_mins_local list                 # show upcoming/captured meetings
    python -m three_mins_local run --no-fixtures     # require live data (will fail offline)
"""
from __future__ import annotations

import argparse
import logging
import sys

from .config import Settings
from .pipeline import Pipeline


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.INFO if verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )


def _cmd_list(args) -> int:
    pipe = Pipeline(allow_fixtures=not args.no_fixtures)
    meetings = pipe.list_meetings(limit=args.limit)
    if not meetings:
        print("No meetings found.")
        return 1
    print(f"Found {len(meetings)} meeting(s):\n")
    for m in meetings:
        print(f"  [{m.id}] {m.date}  {m.committee or 'City Council'}")
        print(f"      {m.title}")
        if m.council_files:
            print(f"      council files: {', '.join(m.council_files)}")
    return 0


def _cmd_run(args) -> int:
    settings = Settings()
    pipe = Pipeline(settings=settings, allow_fixtures=not args.no_fixtures)

    mode = "Gemini" if pipe.llm.available else "deterministic templates"
    print(f"3 Mins Local — generating with {mode}.\n", file=sys.stderr)

    results = pipe.run_latest(limit=args.limit)
    if not results:
        print("Nothing to generate.")
        return 1

    for result in results:
        paths = pipe.save(result)
        nl = result.newsletter
        print(
            f"✓ {result.meeting.title} ({result.meeting.date}) — "
            f"{nl.word_count()} words, {len(result.public_comments)} public comments",
            file=sys.stderr,
        )
        print(f"  → {paths['markdown']}", file=sys.stderr)
        if args.print_issue:
            print("\n" + "=" * 72)
            print(nl.to_markdown())
            print("=" * 72 + "\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="three-mins-local", description=__doc__)
    parser.add_argument("-v", "--verbose", action="store_true", help="verbose logging")
    parser.add_argument("--no-fixtures", action="store_true", help="require live data (no offline fallback)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_list = sub.add_parser("list", help="list meetings from the calendar")
    p_list.add_argument("--limit", type=int, default=10)

    p_run = sub.add_parser("run", help="generate newsletter(s) for the latest meeting(s)")
    p_run.add_argument("--limit", type=int, default=1)
    p_run.add_argument("--print", dest="print_issue", action="store_true", help="print the issue to stdout")

    args = parser.parse_args(argv)
    _setup_logging(args.verbose)

    if args.command == "list":
        return _cmd_list(args)
    if args.command == "run":
        return _cmd_run(args)
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
