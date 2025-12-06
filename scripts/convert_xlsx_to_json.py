#!/usr/bin/env python3
"""
Convert a single-column XLSX quiz file into JSON.

Assumes each question starts with a header token (default: lines beginning with
`TK`) and all following rows up to the next header are the answers/notes.

Usage:
    python scripts/convert_xlsx_to_json.py quizzer.xlsx public/deck.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable, List


def col_letter_to_index(col: str) -> int:
    """Convert column letter (A, B, ..., Z, AA, AB, ...) to 0-based index."""
    result = 0
    for char in col.upper():
        result = result * 26 + (ord(char) - ord('A') + 1)
    return result - 1


def load_rows(path: Path, sheet: str = "sheet1") -> List[List[str]]:
    """Read a worksheet's rows from an XLSX without external deps."""
    with zipfile.ZipFile(path) as zf:
        shared: List[str] = []
        try:
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root:
                text = "".join(node.text or "" for node in si.iter() if node.tag.endswith("t"))
                shared.append(text)
        except KeyError:
            shared = []

        sheet_xml = f"xl/worksheets/{sheet}.xml"
        root = ET.fromstring(zf.read(sheet_xml))
        rows: List[List[str]] = []
        for row in root.iterfind(".//{*}sheetData/{*}row"):
            row_data: dict[int, str] = {}
            max_col = 0
            for cell in row:
                ref = cell.get("r", "")
                # Extract column letters from cell reference (e.g., "A1" -> "A", "AB12" -> "AB")
                col_letters = "".join(c for c in ref if c.isalpha())
                if not col_letters:
                    continue
                col_idx = col_letter_to_index(col_letters)
                max_col = max(max_col, col_idx)

                v = cell.find("{*}v")
                if v is None:
                    row_data[col_idx] = ""
                    continue
                if cell.get("t") == "s":
                    idx = int(v.text)
                    row_data[col_idx] = shared[idx] if idx < len(shared) else ""
                else:
                    row_data[col_idx] = v.text or ""

            # Build row with proper column positions (fill gaps with empty strings)
            vals = [row_data.get(i, "") for i in range(max_col + 1)]
            rows.append(vals)
        return rows


def cells_to_cards(cells: List[str], header_regex: str = r"^TK") -> list[dict]:
    """Convert a flat list of cells into question/answer cards."""
    header_re = re.compile(header_regex, flags=re.IGNORECASE)
    cards: list[dict] = []
    current: dict | None = None
    for cell in cells:
        if header_re.match(cell):
            if current:
                cards.append(current)
            current = {"question": cell, "answers": []}
        else:
            if current is None:
                current = {"question": "Untitled", "answers": []}
            current["answers"].append(cell)
    if current:
        cards.append(current)
    return cards


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Convert XLSX quiz to JSON deck.")
    parser.add_argument("xlsx_path", type=Path, help="Path to the XLSX file.")
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=Path("public/deck.json"),
        help="Where to write the JSON deck.",
    )
    parser.add_argument(
        "--header-pattern",
        default=r"^TK",
        help="Regex that matches question header rows. Default: ^TK",
    )
    parser.add_argument(
        "--sheet",
        default="sheet1",
        help="Worksheet XML name (sheet1, sheet2...). Default: sheet1",
    )
    args = parser.parse_args(argv)

    rows = load_rows(args.xlsx_path, sheet=args.sheet)

    # Determine the number of columns
    num_cols = max(len(row) for row in rows) if rows else 0

    # Process each column independently to avoid mixing answers between questions
    all_cards: list[dict] = []
    for col_idx in range(num_cols):
        # Extract just this column's cells as a flat list
        col_cells: List[str] = []
        for row in rows:
            if len(row) > col_idx:
                cell = (row[col_idx] or "").strip()
                if cell:
                    col_cells.append(cell)
        # Parse questions/answers from this column's isolated data
        col_cards = cells_to_cards(col_cells, header_regex=args.header_pattern)
        all_cards.extend(col_cards)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(all_cards, indent=2), encoding="utf-8")
    print(f"Wrote {len(all_cards)} cards to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
