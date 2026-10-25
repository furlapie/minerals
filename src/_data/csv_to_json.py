#!/usr/bin/env python3
""" Converts the specimen collection CSV export into specimens.json
and modelgallery.json (one entry per unique 3D shape).

Expected CSV headers (any order):
shelf, box, number, color, shiny, type, display_name, main, habit, matrix,
from_who, from_where, country, date_acquired, weight_g,
quantity, price, tier, description, wip

Usage:
python csv_to_json.py specimens.csv specimens.json
"""

import csv
import hashlib
import json
import os
import re
import unicodedata
import sys


def slugify(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^a-zA-Z0-9\s-]', '', text).lower()
    return re.sub(r'[\s-]+', '-', text).strip('-')


COLOR_PALETTE = {
    1: "#F5F0E6",   # White / Colorless
    2: "#8A8A8A",   # Gray
    3: "#525252",   # Dark Gray
    4: "#1A1A1A",   # Black
    5: "#D9C7A3",   # Cream / Beige/Tan
    6: "#7B5233",   # Brown
    7: "#4A3728",   # Dark Brown
    8: "#531A13",   # Dark Red
    9: "#C0392B",   # Red
    10: "#E08B2F",  # Orange
    11: "#E8C547",  # Yellow
    12: "#4C9A5B",  # Green
    13: "#1F5C33",  # Dark Green
    14: "#2FA8A0",  # Teal / Turquoise
    15: "#3468C0",  # Blue
    16: "#1B3A8C",  # Deep Blue / Indigo
    17: "#402B52",  # Dark Purple
    18: "#7B4FA0",  # Purple / Violet
    19: "#E8A0BF",  # Pink / Rose
    20: "#C9A227",  # Metallic Gold
}


def to_int(value, default=0):
    value = (value or "").strip()
    if value == "":
        return default
    try:
        return int(float(value))
    except ValueError:
        return default


def to_float(value, default=0):
    value = (value or "").strip()
    if value == "":
        return default
    cleaned = "".join(ch for ch in value if ch.isdigit() or ch in ".-")
    try:
        return float(cleaned) if "." in cleaned else int(cleaned)
    except ValueError:
        return default


def to_bool(value):
    return str(value).strip() in ("1", "true", "True", "Y", "y")


def parse_colors(value):
    value = (value or "").strip()
    if value == "":
        return []

    hexes = []
    for part in value.split(" ")[:3]:
        part = part.strip()
        if part == "":
            continue
        try:
            color_id = int(part)
        except ValueError:
            print(f"WARNING: non-numeric color id '{part}' — skipped")
            continue
        hex_value = COLOR_PALETTE.get(color_id)
        if hex_value is None:
            print(f"WARNING: unknown color id '{color_id}' — skipped (add it to COLOR_PALETTE)")
            continue
        hexes.append(hex_value)

    return hexes


def build_origin(from_where, country):
    from_where = (from_where or "").strip()
    country = (country or "").strip()

    if from_where and country:
        return f"{from_where}, {country}"
    elif from_where:
        return from_where
    elif country:
        return country
    return ""


# ─── 3D MODEL RESOLUTION ───────────────────────────────────────────

def resolve_model(main, habit, habits_dir):
    """specific (species-habit.stl) -> generic (habit.stl) -> None"""
    stems = []
    if main:
        stems.append(f"{slugify(main)}-{habit}")
    stems.append(habit)
    for stem in stems:
        if os.path.exists(os.path.join(habits_dir, stem + ".stl")):
            return stem
    return None


def build_gallery(specimens, habits_dir):
    """One entry per unique shape: files with identical bytes merge into one card."""
    groups = {}
    for s in specimens:
        for m in s["models"]:
            with open(os.path.join(habits_dir, m["file"] + ".stl"), "rb") as fh:
                digest = hashlib.md5(fh.read()).hexdigest()
            g = groups.setdefault((m["habit"], digest),
                                  {"habit": m["habit"], "files": set(), "species": set(), "specimens": set()})
            g["files"].add(m["file"])
            if m["main"]:
                g["species"].add(m["main"])
            g["specimens"].add(s["slug"])

    out = []
    for g in groups.values():
        species = sorted(g["species"])
        n = len(species)
        generic = g["habit"] in g["files"]
        if generic and n > 3:
            label = f"{n} species"
        else:
            label = " · ".join(species[:3]) + (f" +{n - 3}" if n > 3 else "")
        out.append({
            "habit": g["habit"],
            "file": g["habit"] if generic else min(g["files"]),
            "species": species,
            "specimen_count": len(g["specimens"]),
            "label": label,
        })
    out.sort(key=lambda e: (e["habit"], e["label"].lower()))
    return out


# ─── MAIN CONVERSION ───────────────────────────────────────────────

def convert(csv_path, json_path):
    specimens = []
    habits_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "habits"))

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            box = to_int(row.get("box"))
            number = to_int(row.get("number"))
            name_raw = (row.get("display_name") or row.get("name") or "").strip()

            main_str = (row.get("main") or "").strip()
            habit_str = (row.get("habit") or "").strip()

            main_parts = [m.strip() for m in main_str.split(",")]
            habit_parts = [h.strip() for h in habit_str.split(",")]

            models = []
            for i, h in enumerate(habit_parts):
                if not h:
                    continue
                main = main_parts[i] if i < len(main_parts) else ""
                stem = resolve_model(main, h, habits_dir)
                if stem:
                    models.append({"main": main, "habit": h, "file": stem})

            has_specific = bool(models)   # now means "has any 3D model"

            specimen = {
                "slug": f"{box}-{number}",
                "shelf": to_int(row.get("shelf")),
                "box": box,
                "number": number,
                "colors": parse_colors(row.get("color")),
                "shiny": to_bool(row.get("shiny")),
                "type": (row.get("type") or "").strip(),
                "name": name_raw,
                "main": main_str,
                "habit": habit_str,
                "matrix": (row.get("matrix") or "").strip(),
                "from_who": (row.get("from_who") or "").strip(),
                "from_where": build_origin(row.get("from_where"), row.get("country")),
                "date_acquired": to_int(row.get("date_acquired")),
                "weight_g": to_float(row.get("weight_g")),
                "quantity": to_int(row.get("quantity"), default=1),
                "price": to_float(row.get("price")),
                "tier": to_int(row.get("tier")),
                "description": (row.get("description") or "").strip(),
                "wip": to_bool(row.get("wip")),
                "has_specific": has_specific,
                "models": models,
            }
            specimens.append(specimen)

    specimens.sort(key=lambda m: (m["shelf"], m["box"], m["number"]))

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(specimens, f, ensure_ascii=False, indent=2)

    gallery = build_gallery(specimens, habits_dir)
    gallery_path = os.path.join(os.path.dirname(os.path.abspath(json_path)), "modelgallery.json")
    with open(gallery_path, "w", encoding="utf-8") as f:
        json.dump(gallery, f, ensure_ascii=False, indent=2)
    print(f"{len(gallery)} unique 3D shapes -> {gallery_path}")

    return specimens


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "specimens.csv"
    json_path = sys.argv[2] if len(sys.argv) > 2 else "specimens.json"
    result = convert(csv_path, json_path)
    print(f"Converted {len(result)} specimens -> {json_path}")

    slugs = [m["slug"] for m in result]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        print(f"WARNING: duplicate slugs found (check box/number pairs): {dupes}")