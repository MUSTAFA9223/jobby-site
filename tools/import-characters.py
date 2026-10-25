"""Losslessly package the original embedded glTF characters as individual GLBs."""
import base64
import json
import struct
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "public/world"
existing = [
    dict(id="JOBBY", name="JOBBY 3D (Prototype)", icon="✨", cost=0, size=1941348),
    dict(id="Casual_Male", name="Explorer", icon="🧑", cost=0, size=1238384),
    dict(id="Ninja_Male", name="Ninja", icon="🥷", cost=0, size=1058660),
    dict(id="Pug", name="Pug", icon="🐶", cost=0, size=1045324),
    dict(id="Wizard", name="Wizard", icon="🧙", cost=80, size=1260568),
    dict(id="Pirate_Female", name="Pirate", icon="🏴‍☠️", cost=120, size=1413296),
]
known = {a['id'] for a in existing}
catalog = list(existing)
with zipfile.ZipFile(sys.argv[1]) as archive:
    for filename in sorted(archive.namelist()):
        if not filename.endswith('.gltf'):
            continue
        ident = Path(filename).stem
        if ident in known:
            continue
        model = json.loads(archive.read(filename))
        binary = bytearray()
        for index, buffer in enumerate(model['buffers']):
            uri = buffer['uri']
            assert uri.startswith('data:') and ';base64,' in uri
            while len(binary) % 4:
                binary.append(0)
            offset = len(binary)
            payload = base64.b64decode(uri.split(',', 1)[1])
            assert len(payload) == buffer['byteLength']
            binary.extend(payload)
            for view in model.get('bufferViews', []):
                if view['buffer'] == index:
                    view['byteOffset'] = view.get('byteOffset', 0) + offset
        for view in model.get('bufferViews', []):
            view['buffer'] = 0
        model['buffers'] = [dict(byteLength=len(binary))]
        document = json.dumps(model, separators=(',', ':')).encode()
        document += b' ' * (-len(document) % 4)
        binary += b'\0' * (-len(binary) % 4)
        glb = (struct.pack('<4sII', b'glTF', 2, 28 + len(document) + len(binary))
               + struct.pack('<I4s', len(document), b'JSON') + document
               + struct.pack('<I4s', len(binary), b'BIN\0') + binary)
        (root / 'models' / (ident + '.glb')).write_bytes(glb)
        catalog.append(dict(id=ident, name=ident.replace('_', ' '), icon='🔒',
                            cost=None, locked=True, size=len(glb)))
    assert len(catalog) == 53
for avatar in catalog:
    avatar['portrait'] = './assets/jobby-original.webp' if avatar['id'] == 'JOBBY' else './assets/characters/' + avatar['id'] + '.webp'
source = ('// Original characters retain their free/points access. New arrivals are preview-only.\n'
          + 'export const AVATARS = ' + json.dumps(catalog, indent=1, ensure_ascii=False) + ';\n'
          + 'export const canUseAvatar = (avatar, state={}) => !!avatar && !avatar.locked && '
            '(avatar.cost === 0 || (Array.isArray(state.unlocked) && state.unlocked.includes(avatar.id)));\n')
(root / 'characters.js').write_text(source)
print(f'Imported {len(catalog)-len(existing)} locked characters; {len(catalog)} total.')
