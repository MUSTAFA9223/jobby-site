# JOBBY WORLD — Alpha 0.1

This folder is an independent JOBBY WORLD prototype. It does not replace the JOBBY website, the viewer, or any previous game.

## Current features
- Three.js world and simple wall collisions, 3 collectible keys and an exit.
- Five user-provided glTF characters with original idle/walk/run/jump animations.
- Touchscreen joystick, run and jump controls, orbit camera.
- Three free characters and two unlocked with temporary points.
- Solo gameplay and local points using localStorage (not a secure economy).

## Character loading
Models are loaded on demand from the user-owned archive at:
https://github.com/MUSTAFA9223/JOBBY-3D-Viewer/blob/main/characters.zip

This keeps the prototype in one directory without duplicating the 21MB archive, but **the first visit downloads about 21MB**, and requires the archive's URL to remain available. In a future optimization, publish individual compressed GLB models to avoid downloading all 52 characters.

## Not yet available
Online multiplayer, global leaderboard, real-world rewards, server-backed character ownership, maze levels, monster AI and Telegram Mini App authentication.

## Usage
The standalone entry point is /world/index.html when served from the JOBBY website's public folder.
Code changes to this folder can be made without editing the public website homepage.

## Licenses
Code of this prototype is editable by the repository owner. The glTF models are user-provided and their upstream license must be verified before public commercial use. Three.js and JSZip are third-party libraries under their own licenses.
