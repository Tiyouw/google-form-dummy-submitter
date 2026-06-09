#!/usr/bin/env python3
"""
Google Form Dummy Submitter

Submit rows from a CSV into a public Google Form for owned QA/testing.

Safety defaults:
- Dry-run by default; nothing is submitted unless --submit is passed.
- Validates field count, headers, required values, and choice values first.
- Handles many multi-section Google Forms by sending full pageHistory.

Use only for forms you own / have permission to test. Do not use this to fake
real survey respondents or misrepresent dummy data as real responses.
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import random
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)

TIMESTAMP_HEADERS = {
    "timestamp",
    "stempel waktu",
    "cap waktu",
    "time stamp",
    "horodateur",
    "marca temporal",
}


@dataclass(frozen=True)
class Field:
    """A single submit-able Google Forms field."""

    title: str
    entry_id: int
    required: bool
    options: list[str]
    item_type: int | None = None

    @property
    def entry_name(self) -> str:
        return f"entry.{self.entry_id}"

    @property
    def sentinel_name(self) -> str:
        return f"entry.{self.entry_id}_sentinel"


def normalize_text(value: Any) -> str:
    """Normalize text for matching headers/options without changing submit values."""
    value = "" if value is None else str(value)
    value = value.replace("\xa0", " ")
    value = value.replace("–", "-").replace("—", "-").replace("−", "-")
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value.lower()


def extract_hidden_inputs(page_html: str) -> dict[str, str]:
    hidden: dict[str, str] = {}
    for tag in re.findall(r"<input[^>]+type=\"hidden\"[^>]*>", page_html):
        name_match = re.search(r'name="([^"]+)"', tag)
        if not name_match:
            continue
        value_match = re.search(r'value="([^"]*)"', tag)
        hidden[html.unescape(name_match.group(1))] = html.unescape(value_match.group(1)) if value_match else ""
    return hidden


def fetch_form(
    session: requests.Session,
    form_url: str,
    *,
    auto_page_history: bool = True,
    timeout: float = 30,
) -> tuple[str, list[Field], dict[str, str]]:
    """Fetch a Google Form and return page HTML, fields, and hidden payload values."""
    resp = session.get(form_url, timeout=timeout)
    resp.raise_for_status()
    page = resp.text

    match = re.search(r"var FB_PUBLIC_LOAD_DATA_ = (.*?);</script>", page, flags=re.S)
    if not match:
        raise RuntimeError(
            "Tidak menemukan FB_PUBLIC_LOAD_DATA_ di HTML. "
            "Pastikan URL adalah Google Form publik /viewform dan tidak butuh login."
        )

    public_data = json.loads(match.group(1))
    items = public_data[1][1]
    fields: list[Field] = []
    section_like_count = 0

    for item in items:
        item_type = item[3] if len(item) > 3 else None

        # In Google Forms public payloads, type=8 commonly represents section,
        # title, or page-like text blocks. On some multi-section forms the hidden
        # pageHistory from the first rendered page is only "0". Direct final POST
        # with pageHistory=0 can be accepted but silently ignore later sections.
        if item_type == 8:
            section_like_count += 1

        questions = item[4] if len(item) > 4 else None
        if not isinstance(questions, list):
            continue

        for question in questions:
            if not (isinstance(question, list) and question and isinstance(question[0], int)):
                continue

            options: list[str] = []
            if len(question) > 1 and isinstance(question[1], list):
                options = [str(opt[0]) for opt in question[1] if isinstance(opt, list) and opt]

            fields.append(
                Field(
                    title=str(item[1]),
                    entry_id=int(question[0]),
                    required=bool(question[2]) if len(question) > 2 else False,
                    options=options,
                    item_type=item_type,
                )
            )

    action_match = re.search(r'<form[^>]+action="([^"]+)"', page)
    if action_match:
        action_url = html.unescape(action_match.group(1))
    else:
        action_url = urljoin(form_url, form_url.replace("/viewform", "/formResponse"))

    hidden = extract_hidden_inputs(page)

    if auto_page_history and section_like_count:
        hidden["pageHistory"] = ",".join(str(i) for i in range(section_like_count + 1))
        hidden["__page_history_note"] = f"auto pageHistory from {section_like_count} section/title blocks"

    hidden["__inferred_page_history"] = hidden.get("pageHistory", "0")
    hidden["__section_like_count"] = str(section_like_count)
    hidden["__action_url"] = action_url
    return page, fields, hidden


def read_csv_rows(csv_path: str, *, encoding: str = "utf-8-sig") -> tuple[list[str], list[dict[str, str]]]:
    with open(csv_path, newline="", encoding=encoding) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        headers = list(reader.fieldnames or [])
    if not headers:
        raise RuntimeError("CSV tidak memiliki header.")
    if not rows:
        raise RuntimeError("CSV kosong atau tidak memiliki data.")
    return headers, rows


def select_csv_headers(csv_headers: list[str], fields: list[Field]) -> list[str]:
    """Select CSV columns that map to form fields, ignoring a leading Timestamp if present."""
    if len(csv_headers) == len(fields):
        return csv_headers

    if len(csv_headers) == len(fields) + 1 and normalize_text(csv_headers[0]) in TIMESTAMP_HEADERS:
        return csv_headers[1:]

    raise RuntimeError(
        f"Jumlah kolom CSV ({len(csv_headers)}) tidak sama dengan jumlah input Form ({len(fields)}).\n"
        "Tips: CSV harus punya header sesuai pertanyaan form. Jika CSV hasil export Google Forms, "
        "kolom Timestamp di awal boleh ada dan akan diabaikan otomatis."
    )


def value_for_field(row: dict[str, str], header: str, field: Field) -> tuple[str, str | None]:
    raw_value = (row.get(header) or "").strip()
    if not field.options:
        return raw_value, None

    if raw_value in field.options:
        return raw_value, None

    normalized = normalize_text(raw_value)
    for option in field.options:
        if normalize_text(option) == normalized:
            return option, f"{raw_value!r} -> {option!r}"

    raise ValueError(
        f"Nilai opsi tidak valid untuk field {field.title!r}: {raw_value!r}. "
        f"Opsi valid: {field.options!r}"
    )


def build_payload(
    row: dict[str, str],
    headers: list[str],
    fields: list[Field],
    hidden: dict[str, str],
    *,
    page_history: str | None = None,
    name_prefix: str = "",
) -> tuple[dict[str, str], list[str]]:
    payload: dict[str, str] = {}
    notes: list[str] = []

    # Include hidden Google Forms state fields. Internal helper keys begin with __
    # and must not be sent to Google.
    for key, value in hidden.items():
        if key.startswith("__"):
            continue
        payload[key] = value

    effective_page_history = page_history or hidden.get("__inferred_page_history") or hidden.get("pageHistory", "0")
    partial_answers: list[list[Any]] = []

    for index, (header, field) in enumerate(zip(headers, fields)):
        value, note = value_for_field(row, header, field)
        if index == 0 and name_prefix:
            value = f"{name_prefix}{value}"
        if field.required and not value:
            raise ValueError(f"Field wajib kosong: {field.title!r}")

        payload[field.entry_name] = value

        # Choice/scale fields usually have *_sentinel inputs. Add sentinels for
        # all pages, not just first rendered page, so direct POST resembles a
        # real browser submission that visited every page.
        if field.options:
            payload.setdefault(field.sentinel_name, "")

        partial_answers.append([None, field.entry_id, [value], 0])
        if note:
            notes.append(f"{field.title}: {note}")

    payload["pageHistory"] = effective_page_history
    if payload.get("fbzx"):
        payload["partialResponse"] = json.dumps([partial_answers, None, payload["fbzx"]], separators=(",", ":"))

    return payload, notes


def validate(
    csv_headers: list[str],
    rows: list[dict[str, str]],
    fields: list[Field],
    hidden: dict[str, str],
    *,
    page_history: str | None = None,
) -> tuple[list[str], list[str]]:
    selected_headers = select_csv_headers(csv_headers, fields)
    messages: list[str] = []

    mismatches: list[str] = []
    for i, (header, field) in enumerate(zip(selected_headers, fields), start=1):
        if normalize_text(header) != normalize_text(field.title):
            mismatches.append(f"#{i}: CSV={header!r} | Form={field.title!r}")
    if mismatches:
        raise RuntimeError(
            "Header CSV tidak cocok dengan judul field Form:\n"
            + "\n".join(mismatches[:20])
            + ("\n..." if len(mismatches) > 20 else "")
        )

    normalization_count = 0
    for row_index, row in enumerate(rows, start=1):
        try:
            _, notes = build_payload(row, selected_headers, fields, hidden, page_history=page_history)
            normalization_count += len(notes)
        except Exception as exc:
            raise RuntimeError(f"Validasi gagal pada baris CSV #{row_index}: {exc}") from exc

    messages.append(f"OK: {len(rows)} baris CSV valid.")
    messages.append(f"OK: {len(fields)} field Form cocok dengan {len(selected_headers)} kolom CSV.")
    messages.append(f"OK: pageHistory yang dipakai: {page_history or hidden.get('pageHistory', '<kosong>')!r}.")
    if hidden.get("__page_history_note"):
        messages.append(f"Info: {hidden['__page_history_note']}.")
    if normalization_count:
        messages.append(f"Catatan: {normalization_count} nilai opsi akan dinormalisasi agar cocok dengan opsi Form.")
    return messages, selected_headers


def submit_one(
    session: requests.Session,
    action_url: str,
    payload: dict[str, str],
    referer: str,
    *,
    timeout: float = 30,
) -> tuple[bool, int, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Referer": referer,
        "Origin": "https://docs.google.com",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    resp = session.post(action_url, data=payload, headers=headers, timeout=timeout, allow_redirects=True)
    text = resp.text

    success_markers = [
        "form_confirm",
        "Your response has been recorded",
        "Jawaban Anda telah direkam",
        "Respons Anda telah direkam",
        "您的回答已记录",
        "已记录你的回复",
    ]
    error_markers = [
        "This is a required question",
        "Ini adalah pertanyaan yang wajib diisi",
        "必须回答此问题",
        "Required",
    ]

    ok = resp.status_code in (200, 302) and any(marker in text for marker in success_markers)
    if any(marker in text for marker in error_markers):
        ok = False

    snippet = re.sub(r"\s+", " ", text[:500])
    return ok, resp.status_code, snippet


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Submit dummy CSV responses to a public Google Form for owned QA/testing."
    )
    parser.add_argument("--form-url", required=True, help="Google Form /viewform URL.")
    parser.add_argument("--csv", required=True, help="Path ke CSV dummy.")
    parser.add_argument("--dry-run", action="store_true", help="Validasi saja; default jika --submit tidak diberikan.")
    parser.add_argument("--submit", action="store_true", help="Benar-benar submit response ke Google Form.")
    parser.add_argument("--limit", type=int, default=None, help="Batasi jumlah baris yang diproses.")
    parser.add_argument("--start", type=int, default=1, help="Nomor baris data CSV mulai diproses (1-based, tidak termasuk header).")
    parser.add_argument("--delay", type=float, default=0.8, help="Delay dasar antar submit dalam detik.")
    parser.add_argument("--jitter", type=float, default=0.4, help="Random jitter tambahan antar submit dalam detik.")
    parser.add_argument("--encoding", default="utf-8-sig", help="Encoding CSV. Default: utf-8-sig.")
    parser.add_argument("--timeout", type=float, default=30, help="HTTP timeout dalam detik.")
    parser.add_argument("--page-history", default=None, help="Override pageHistory Google Forms, contoh: 0,1,2,3,4,5,6.")
    parser.add_argument("--no-auto-page-history", action="store_true", help="Jangan infer pageHistory dari section/title blocks.")
    parser.add_argument("--name-prefix", default="", help="Prefix sementara untuk field pertama, berguna untuk 1 baris uji.")
    parser.add_argument("--preview-rows", type=int, default=3, help="Jumlah row preview saat dry-run. Default: 3.")
    args = parser.parse_args()

    if args.start < 1:
        raise SystemExit("--start harus >= 1")
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit harus >= 1")
    if args.preview_rows < 0:
        raise SystemExit("--preview-rows harus >= 0")

    csv_path = Path(args.csv).expanduser()
    if not csv_path.exists():
        raise SystemExit(f"CSV tidak ditemukan: {csv_path}")

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    _, fields, hidden = fetch_form(
        session,
        args.form_url,
        auto_page_history=not args.no_auto_page_history,
        timeout=args.timeout,
    )
    csv_headers, rows = read_csv_rows(str(csv_path), encoding=args.encoding)

    page_history = args.page_history or hidden.get("__inferred_page_history") or hidden.get("pageHistory")
    messages, selected_headers = validate(csv_headers, rows, fields, hidden, page_history=page_history)
    for msg in messages:
        print(msg)

    start_index = args.start - 1
    selected_rows = rows[start_index:]
    if args.limit is not None:
        selected_rows = selected_rows[: args.limit]
    if not selected_rows:
        print("Tidak ada baris yang diproses setelah --start/--limit.")
        return 0

    mode = "SUBMIT" if args.submit else "DRY RUN"
    print(f"Mode: {mode}")
    print(f"Action URL: {hidden['__action_url']}")
    print(f"Baris diproses: {args.start} sampai {args.start + len(selected_rows) - 1} ({len(selected_rows)} baris)")

    failures = 0
    for offset, row in enumerate(selected_rows, start=args.start):
        payload, notes = build_payload(
            row,
            selected_headers,
            fields,
            hidden,
            page_history=page_history,
            name_prefix=args.name_prefix,
        )
        name = row.get(selected_headers[0], "").strip() if selected_headers else ""
        display_name = f"{args.name_prefix}{name}" if args.name_prefix else name

        if not args.submit:
            if offset < args.start + args.preview_rows:
                first_keys = [fields[i].entry_name for i in range(min(5, len(fields)))]
                last_keys = [fields[i].entry_name for i in range(max(0, len(fields) - 2), len(fields))]
                preview_keys = list(dict.fromkeys(first_keys + last_keys))
                preview = {key: payload.get(key) for key in preview_keys}
                print(f"DRY row #{offset}: {display_name!r} preview={preview}")
                if notes:
                    print(f"  normalisasi: {notes[:3]}")
            continue

        ok, status, snippet = submit_one(
            session,
            hidden["__action_url"],
            payload,
            args.form_url,
            timeout=args.timeout,
        )
        if ok:
            print(f"OK submit row #{offset}: {display_name!r} status={status}")
        else:
            failures += 1
            print(f"FAIL submit row #{offset}: {display_name!r} status={status} snippet={snippet!r}", file=sys.stderr)
            break

        sleep_for = args.delay + random.random() * args.jitter
        time.sleep(sleep_for)

    if args.submit and failures:
        print(f"Selesai dengan kegagalan: {failures}", file=sys.stderr)
        return 2

    print("Selesai.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
