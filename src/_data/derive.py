#!/usr/bin/env python3
import hashlib
import json
import os
import shutil
import sys
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
HABITS_DIR = os.path.abspath(os.path.join(HERE, "..", "habits"))
SPECIMENS = os.path.join(HERE, "specimens.json")
GALLERY = os.path.join(HERE, "modelgallery.json")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ORIGINALS = os.path.join(ROOT, "originals")
# The temporary folder where Sveltia drops new images
UPLOADS_DIR = os.path.abspath(os.path.join(HERE, "..", "_uploads"))

def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9\s-]", "", text).lower()
    return re.sub(r"[\s-]+", "-", text).strip("-")

def split_list(value):
    return [p.strip() for p in (value or "").split(",")]

def resolve_model(main, habit):
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

    # Check if we have new images to process
    has_uploads = os.path.exists(UPLOADS_DIR) and len(os.listdir(UPLOADS_DIR)) > 0
    if has_uploads:
        print(f"Found new images in {UPLOADS_DIR}, processing...")
        os.makedirs(ORIGINALS, exist_ok=True)

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
        
        # Image processing logic
        photo = s.get("photo")
        if photo and has_uploads:
            # Sveltia saves the path as "/src/_uploads/IMG_123.jpg"
            # We only need the filename
            filename = os.path.basename(photo)
            src = os.path.join(UPLOADS_DIR, filename)
            ext = os.path.splitext(filename)[1].lower()
            dst = os.path.join(ORIGINALS, f"{s['box']}.{s['number']}{ext}")
            
            if os.path.exists(src):
                # 1. Copy to originals with correct name
                shutil.copyfile(src, dst)
                print(f"  -> Copied {filename} to originals/{s['box']}.{s['number']}{ext}")
                
                # 2. Scrap the temporary upload
                os.remove(src)
                print(f"  -> Deleted {filename} from _uploads")
                
        s["has_specific"] = bool(s["models"])

    if dupes:
        print(f"ERROR: duplicate slugs: {sorted(dupes)}")
        sys.exit(1)

    for i, s in enumerate(specimens):
        s["cms_index"] = i

    specimens.sort(key=lambda m: (m.get("shelf") or 0, m.get("box") or 0, m.get("number") or 0))

    with open(SPECIMENS, "w", encoding="utf-8") as f:
        json.dump(specimens, f, ensure_ascii=False, indent=2)

    gallery = build_gallery(specimens)
    with open(GALLERY, "w", encoding="utf-8") as f:
        json.dump(gallery, f, ensure_ascii=False, indent=2)

    print(f"{len(specimens)} specimens, {len(gallery)} unique 3D shapes")

if __name__ == "__main__":
    main()