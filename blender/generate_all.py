"""Orchestrates every Blender asset script and updates the web manifest.

On a machine with Blender installed:
  blender -b --python blender/generate_all.py
  blender -b --python blender/generate_all.py -- --no-bake   (faster, flat colors)

Each generator runs in the same Blender process after a scene reset. Results
land in blender/out/ and public/assets/models/, and manifest.json entries are
switched to enabled:true for files that exported successfully.
"""
import importlib
import json
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)

import bhl_common as C  # noqa: E402

JOBS = [
    ("generate_earth", "earth.glb", "earth"),
    ("generate_spaceship", "spacecraft.glb", "spacecraft"),
    ("generate_black_hole", "debris.glb", "debris"),
    ("generate_environment", "station.glb", "station"),
]


def main():
    ok = []
    for module_name, filename, key in JOBS:
        print(f"\n[BHL] === {module_name} ===")
        try:
            mod = importlib.import_module(module_name)
            objs = mod.build()
            C.export_glb(filename, objects=objs)
            ok.append(key)
        except Exception:  # keep going; one failing asset must not block the rest
            traceback.print_exc()
            print(f"[BHL] {module_name} failed, the app will keep its procedural fallback")
    manifest_path = os.path.normpath(os.path.join(HERE, "..", "public", "assets", "manifest.json"))
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        for key in ok:
            manifest["assets"][key]["enabled"] = True
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
        print(f"[BHL] manifest updated: {ok}")
    except Exception as e:
        print(f"[BHL] could not update manifest: {e}")


if __name__ == "__main__":
    main()
