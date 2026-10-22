import json
import re
from datetime import datetime

import openpyxl

SLOTS = {
    3: ("08:00:00", "09:40:00"),
    5: ("10:00:00", "11:40:00"),
    7: ("12:00:00", "13:40:00"),
}
PREFIX = re.compile(r"^\((?:Remidi UAS|Remidi|UTS|UAS)\)\s*")


def clean(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def base_name(title):
    return PREFIX.sub("", title).strip()


workbook = openpyxl.load_workbook(r"d:\Downloads\Jadwal Semester I.xlsx", data_only=True)
sheet = workbook.active
rows = list(sheet.iter_rows(values_only=True))
start = 0
for index, row in enumerate(rows):
    if row and row[0] and str(row[0]).strip().startswith("Minggu"):
        start = index + 1
        break

week = None
events = []
for row in rows[start:]:
    label = clean(row[0]) if row and row[0] else ""
    if label.startswith("PJMT") or label.startswith("MT"):
        break
    if label:
        week = label
    date = row[2] if row and len(row) > 2 else None
    if not isinstance(date, datetime):
        continue
    for column, (start_time, end_time) in SLOTS.items():
        title = clean(row[column] if column < len(row) else None)
        if not title or title.lower() == "istirahat":
            continue
        events.append(
            {
                "date": date.strftime("%Y-%m-%d"),
                "start": start_time,
                "end": end_time,
                "title": title,
                "base": base_name(title),
                "week": week,
            }
        )

counts = {}
for event in events:
    counts[event["base"]] = counts.get(event["base"], 0) + 1

courses = sorted(name for name, count in counts.items() if count >= 2)
print(json.dumps({"courses": courses, "events": events}, ensure_ascii=False))
