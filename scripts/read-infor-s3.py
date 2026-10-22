import json
import re
from datetime import date, timedelta

import openpyxl

SOURCE = r"d:\Downloads\JADWAL MATKUL SEMESTER 3 INFOR (1).xlsx"
DAY_INDEX = {"SENIN": 0, "SELASA": 1, "RABU": 2, "KAMIS": 3, "JUMAT": 4}
TERM_START = date(2026, 8, 10)
TERM_END = date(2026, 12, 5)
HOLIDAYS = {
    date(2026, 8, 17): "Hari Proklamasi Kemerdekaan",
    date(2026, 8, 25): "Maulid Nabi Muhammad SAW",
}


def clean(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def clock(value):
    hours = re.findall(r"(\d{1,2})[.:](\d{2})", clean(value))
    if len(hours) != 2:
        return None
    return tuple(f"{int(hour):02d}:{minute}:00" for hour, minute in hours)


workbook = openpyxl.load_workbook(SOURCE, data_only=True)
sheet = workbook["Semester 3"]
slots = []
current_day = None
current = None

for row in sheet.iter_rows(min_row=4, values_only=True):
    day = clean(row[0]).upper().replace("'", "")
    start_end = clock(row[1])
    room = clean(row[2])
    group = clean(row[3])
    title = clean(row[4])
    lecturer = clean(row[5])
    if day in DAY_INDEX:
        current_day = DAY_INDEX[day]
    if start_end:
        current = {
            "day": current_day,
            "start": start_end[0],
            "end": start_end[1],
            "title": "",
            "rooms": [],
            "groups": [],
            "lecturers": [],
        }
        slots.append(current)
    if current is None:
        continue
    if title:
        current["title"] = title
    if room and room not in current["rooms"]:
        current["rooms"].append(room)
    if group and group not in current["groups"]:
        current["groups"].append(group)
    if lecturer and lecturer not in current["lecturers"]:
        current["lecturers"].append(lecturer)

courses = []
for slot in slots:
    name = slot["title"].rstrip("*").strip()
    if name and name not in courses:
        courses.append(name)

events = []
day = TERM_START
while day <= TERM_END:
    if day in HOLIDAYS:
        events.append(
            {
                "date": day.isoformat(),
                "start": "08:00:00",
                "end": "16:00:00",
                "title": HOLIDAYS[day],
                "base": "",
                "location": "",
                "description": "Libur nasional. Tidak ada kuliah.",
                "kind": "libur",
            }
        )
    elif day.weekday() <= 4:
        for slot in slots:
            if slot["day"] != day.weekday() or not slot["title"]:
                continue
            praktikum = slot["title"].endswith("*")
            name = slot["title"].rstrip("*").strip()
            if len(slot["rooms"]) > 1:
                location = " dan ".join(
                    f"{room} ({group.replace('2025 ', '')})"
                    for room, group in zip(slot["rooms"], slot["groups"])
                )
                detail = "Praktikum. " + ". ".join(
                    f"Kelas {group.replace('2025 ', '')} di {room}"
                    for room, group in zip(slot["rooms"], slot["groups"])
                )
            else:
                location = slot["rooms"][0] if slot["rooms"] else ""
                group = slot["groups"][0] if slot["groups"] else "2025 A"
                detail = f"{'Praktikum. ' if praktikum else ''}Kelas {group}."
            events.append(
                {
                    "date": day.isoformat(),
                    "start": slot["start"],
                    "end": slot["end"],
                    "title": f"Praktikum {name}" if praktikum else name,
                    "base": name,
                    "location": location,
                    "description": detail.strip(),
                    "kind": "praktikum" if praktikum else "kelas",
                }
            )
    day += timedelta(days=1)

lecturers = {}
for slot in slots:
    name = slot["title"].rstrip("*").strip()
    if not name:
        continue
    lecturers.setdefault(name, [])
    for person in slot["lecturers"]:
        if person not in lecturers[name]:
            lecturers[name].append(person)

print(
    json.dumps(
        {"courses": courses, "lecturers": lecturers, "events": events},
        ensure_ascii=False,
    )
)
