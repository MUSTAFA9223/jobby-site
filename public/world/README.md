# JOBBY WORLD — Alpha 0.2

This folder is an independent JOBBY WORLD prototype. It does not replace the JOBBY website, the viewer, or any previous game.

## Current features
- Three.js world and simple wall collisions, 3 collectible keys and an exit.
- Five user-provided glTF characters with original idle/walk/run/jump animations.
- Touchscreen joystick, run and jump controls, orbit camera.
- Three free characters and two unlocked with temporary points.
- Solo gameplay and local points using localStorage (not a secure economy).

## Faster character loading (v0.2)
Each of the five animated models is now stored as an independent, self-contained binary GLB in `public/world/models/` (1.0–1.4 MB each). The initial character selection downloads only that model, not the original 21 MB ZIP. This also fixes the former glTF-loader issue when external resources in the ZIP were unavailable to the loader.

- Models: Casual_Male.glb, Ninja_Male.glb, Pug.glb, Wizard.glb, Pirate_Female.glb.
- Loading progress is shown while downloading.
- Models use normal browser HTTP caching.
- The source `characters.zip` remains in the separate JOBBY-3D-Viewer repository and is not deleted.

## Not yet available
Online multiplayer, global leaderboard, real-world rewards, server-backed character ownership, maze levels, monster AI and Telegram Mini App authentication.

## Usage
The standalone entry point is /world/index.html when served from the JOBBY website's public folder.
Code changes to this folder can be made without editing the public website homepage.

## Licenses
Code of this prototype is editable by the repository owner. The glTF models are user-provided and their upstream license must be verified before public commercial use. Three.js and JSZip are third-party libraries under their own licenses.
