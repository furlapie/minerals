#!/usr/bin/env python3
# python3 src/_data/derive.py && node scripts/optimize-images.js && npx @11ty/eleventy
"""Reads specimens.json (edited via Sveltia) and recomputes derived data:
  - `models` / `has_specific` on every specimen
  - modelgallery.json
Usage: python3 src/_data/derive.py
"""
import hashlib
import json
import os
import sys
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
HABITS_DIR = os.path.abspath(os.path.join(HERE, "..", "habits"))
SPECIMENS = os.path.join(HERE, "specimens.json")
GALLERY = os.path.join(HERE, "modelgallery.json")


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9\s-]", "", text).lower()
    return re.sub(r"[\s-]+", "-", text).strip("-")


def split_list(value):
    return [p.strip() for p in (value or "").split(",")]


def resolve_model(main, habit):
    """specific (species-habit.stl) -> generic (habit.stl) -> None"""
    stems = []
    if main:
        stems.append(f"{slugify(main)}-{habit}")
    stems.append(habit)
    for stem in stems:
        if os.path.exists(os.path.join(HABITS_DIR, stem + ".stl")):
            return stem
    return None


def compute_models(s):
    mains, habits = split_list(s.get("main")), split_list(s.get("habit"))
    models = []
    for i, h in enumerate(habits):
        if not h:
            continue
        main = mains[i] if i < len(mains) else ""
        stem = resolve_model(main, h)
        if stem:
            models.append({"main": main, "habit": h, "file": stem})
    return models


def build_gallery(specimens):
    groups = {}
    for s in specimens:
        for m in s["models"]:
            with open(os.path.join(HABITS_DIR, m["file"] + ".stl"), "rb") as fh:
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


def main():
    with open(SPECIMENS, encoding="utf-8") as f:
        specimens = json.load(f)

    seen, dupes = set(), set()
    for s in specimens:
        slug = s.get("slug", "")
        if slug in seen:
            dupes.add(slug)
        seen.add(slug)
        expected = f"{s.get('box')}-{s.get('number')}"
        if slug != expected:
            print(f"WARNING: slug '{slug}' != box-number '{expected}'")
        s["models"] = compute_models(s)
        s["has_specific"] = bool(s["models"])

    if dupes:
        print(f"ERROR: duplicate slugs: {sorted(dupes)}")
        sys.exit(1)

    # new CMS entries land at the end of the file; prev/next navigation needs this order
    specimens.sort(key=lambda m: (m.get("shelf", 0), m.get("box", 0), m.get("number", 0)))

    with open(SPECIMENS, "w", encoding="utf-8") as f:
        json.dump(specimens, f, ensure_ascii=False, indent=2)

    gallery = build_gallery(specimens)
    with open(GALLERY, "w", encoding="utf-8") as f:
        json.dump(gallery, f, ensure_ascii=False, indent=2)

    print(f"{len(specimens)} specimens, {len(gallery)} unique 3D shapes")


if __name__ == "__main__":
    main()