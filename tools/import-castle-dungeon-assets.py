#!/usr/bin/env python3
"""Import the complete, original CC0 Castle Kit and Modular Dungeons packs.

Requirements: python -m pip install trimesh numpy pillow
Archives are retained, unchanged, in asset-sources/. This importer makes all
models available to the web game; the scene chooses which models to lazy-load.
Run from any directory: python tools/import-castle-dungeon-assets.py
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import tempfile
import zipfile

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial, SimpleMaterial

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = ROOT / "asset-sources"
OUTPUT = ROOT / "public/world/models"

PACKS = {
    "castle": {
        "title": "Kenney Castle Kit 2.0", "author": "Kenney",
        "source": "https://kenney.nl/assets/castle-kit",
        "download": "https://kenney.nl/media/pages/assets/castle-kit/a395102d20-1711543616/kenney_castle-kit.zip",
        "archive": "kenney_castle-kit.zip", "expectedModels": 76,
        "orientation": "Y-up; original GLB coordinates retained. Gates and doors lie in the YZ plane (thin X).",
    },
    "dungeon": {
        "title": "Quaternius Modular Dungeons, Updated May 2019", "author": "Quaternius",
        "source": "https://quaternius.com/packs/modulardungeon.html",
        "authorMirror": "https://opengameart.org/content/lowpoly-modular-dungeon-pack",
        "download": "https://opengameart.org/sites/default/files/Updated%20Modular%20Dungeon%20-%20May%202019.zip",
        "archive": "quaternius-modular-dungeons.zip", "expectedModels": 48,
        "orientation": "Y-up; converted OBJ models recentered horizontally and placed with bottom Y=0. Walls and arches lie in the XY plane (thin Z).",
    },
}


def rounded(v):
    return np.asarray(v).round(6).tolist()


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def category(name):
    for word, group in [
        ("wall", "walls"), ("floor", "floors"), ("ground", "floors"),
        ("arch", "entrances"), ("door", "entrances"), ("gate", "entrances"),
        ("tower", "towers"), ("stairs", "stairs"), ("bridge", "bridges"),
        ("column", "columns"), ("pillar", "columns"), ("fence", "fences"),
        ("trap", "traps"), ("spike", "traps"), ("torch", "lights"),
        ("fire", "lights"), ("table", "furniture"), ("chair", "furniture"),
        ("chest", "storage"), ("crate", "storage"), ("barrel", "storage"),
        ("siege", "contraptions"), ("tree", "nature"), ("rock", "nature"),
    ]:
        if word in name:
            return group
    return "decorations"


def record(path, scene, source_name, source_bounds=None):
    bounds = scene.bounds
    if bounds is None or not np.isfinite(bounds).all():
        raise ValueError(f"Invalid geometry bounds for {path}")
    return {
        "id": path.stem, "file": path.name,
        "url": f"./models/{path.parent.name}/{path.name}",
        "category": category(path.stem), "sourceFile": source_name,
        "bounds": {"min": rounded(bounds[0]), "max": rounded(bounds[1])},
        "size": rounded(scene.extents), "center": rounded(bounds.mean(axis=0)),
        "baseY": round(float(bounds[0, 1]), 6),
        "sourceBounds": None if source_bounds is None else {
            "min": rounded(source_bounds[0]), "max": rounded(source_bounds[1])},
        "vertices": sum(len(g.vertices) for g in scene.geometry.values()),
        "triangles": sum(len(g.faces) for g in scene.geometry.values()),
        "meshes": len(scene.geometry), "bytes": path.stat().st_size,
    }


def import_pack(pack, meta):
    archive = SOURCES / meta["archive"]
    data = archive.read_bytes()
    out = OUTPUT / pack
    out.mkdir(parents=True, exist_ok=True)
    models = []
    with zipfile.ZipFile(archive) as z:
        license_name = next(n for n in z.namelist() if n.lower().endswith("license.txt"))
        license_text = z.read(license_name).decode("utf-8-sig")
        if not re.search(r"CC0|Creative Commons Zero", license_text, re.I):
            raise ValueError(f"The original {pack} archive does not declare CC0")
        (out / "LICENSE.txt").write_text(license_text, encoding="utf-8")
        if pack == "castle":
            prefix = "Models/GLB format/"
            for name in z.namelist():
                if name.startswith(prefix) and not name.endswith("/"):
                    relative = pathlib.PurePosixPath(name[len(prefix):])
                    if ".." in relative.parts:
                        raise ValueError("Unsafe archive path")
                    dest = out / relative
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(z.read(name))
            for path in sorted(out.glob("*.glb")):
                scene = trimesh.load(path, force="scene")
                models.append(record(path, scene, prefix + path.name))
        else:
            with tempfile.TemporaryDirectory(prefix="jobby-dungeon-import-") as tmp:
                tmp = pathlib.Path(tmp)
                # Only OBJ+MTL are needed for conversion. Complete FBX, Blend,
                # license and original preview remain in the original archive.
                for name in z.namelist():
                    if name.lower().endswith((".obj", ".mtl")):
                        (tmp / pathlib.PurePosixPath(name).name).write_bytes(z.read(name))
                for path in sorted(tmp.glob("*.obj")):
                    scene = trimesh.load(path, force="scene", process=False)
                    source_bounds = scene.bounds.copy()
                    # Preserve the original low-poly colors and hard normals.
                    for geom in scene.geometry.values():
                        material = geom.visual.material
                        if isinstance(material, SimpleMaterial):
                            geom.visual.material = PBRMaterial(
                                name=material.name,
                                baseColorFactor=material.diffuse,
                                metallicFactor=0,
                                roughnessFactor=.88,
                                doubleSided=False,
                            )
                    scene.apply_translation([
                        -source_bounds[:, 0].mean(), -source_bounds[0, 1],
                        -source_bounds[:, 2].mean(),
                    ])
                    dest = out / (slug(path.stem) + ".glb")
                    dest.write_bytes(scene.export(file_type="glb"))
                    # Re-import the result, so the manifest describes the file
                    # served to the browser rather than only the source mesh.
                    exported = trimesh.load(dest, force="scene")
                    models.append(record(dest, exported, path.name, source_bounds))
    if len(models) != meta["expectedModels"]:
        raise ValueError(f"Incomplete pack {pack}: {len(models)} models")
    catalog = {
        "pack": pack, "title": meta["title"], "author": meta["author"],
        "source": meta["source"], "license": "CC0-1.0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "orientation": meta["orientation"], "modelCount": len(models),
        "totalModelBytes": sum(x["bytes"] for x in models),
        "archive": meta["archive"], "archiveBytes": len(data),
        "archiveSha256": hashlib.sha256(data).hexdigest(), "models": models,
    }
    (out / "manifest.json").write_text(json.dumps(catalog, indent=2) + "\n")
    (out / "SOURCE.txt").write_text(
        f"{meta['title']}\nAuthor: {meta['author']}\nSource: {meta['source']}\n"
        f"License: CC0 1.0 Universal\n{catalog['licenseUrl']}\n"
        f"Complete original archive: asset-sources/{meta['archive']}\n"
        f"Original archive SHA-256: {catalog['archiveSha256']}\n"
        f"{meta['orientation']}\n"
    )
    print(f"{pack}: {len(models)} GLBs; {catalog['totalModelBytes']} model bytes")
    return {**meta, "archiveBytes": len(data), "archiveSha256": catalog["archiveSha256"],
            "modelCount": len(models), "publicManifest": f"public/world/models/{pack}/manifest.json"}


if __name__ == "__main__":
    sources = {pack: import_pack(pack, meta) for pack, meta in PACKS.items()}
    (SOURCES / "castle-dungeon-sources.json").write_text(json.dumps({
        "license": "CC0-1.0", "downloadedOn": "2026-10-24", "packs": sources,
        "notes": "Original archives are complete and unchanged. Google Drive individual-file downloads hit a public download quota; Quaternius' own OpenGameArt upload provided the complete identical named release instead."
    }, indent=2) + "\n")
