# Complete original Castle and Dungeon packs

These two unchanged original archives contain every file supplied by their
authors, including editable source formats and the original licenses/previews.
They are retained here with identical optional downloads in `public/world/packs/`.
A phone never downloads original asset archives as part of starting a game.

* `kenney_castle-kit.zip`: Kenney Castle Kit 2.0, downloaded from Kenney's website.
  The actual release has 76 GLB models although the web page says 75 files.
* `quaternius-modular-dungeons.zip`: Quaternius Updated Modular Dungeon, May 2019,
  downloaded from the author's own OpenGameArt upload after individual Google
  Drive downloads reached Google's public download quota. All 48 models are
  included in OBJ, FBX and editable Blender formats, plus MTL files and preview.

Both packs' supplied license files explicitly declare **CC0 1.0 Universal**.
Sources, checksums, file counts and byte lengths are in
`castle-dungeon-sources.json`. Original author branding does not imply endorsement.

Run `python tools/import-castle-dungeon-assets.py` to reproduce the public GLB
models and `manifest.json` catalogs. This needs `trimesh`, `numpy`, and `Pillow`.
Dungeon models keep the original colors, are Y-up, and are centered horizontally
with their bottom at Y=0. Kenney GLBs keep their supplied coordinates and texture.
Each manifest records actual bounds and offsets, so placement is unambiguous.

The web scene should load only used model files, share their geometry and
materials between clones, and instance repeated static meshes.
