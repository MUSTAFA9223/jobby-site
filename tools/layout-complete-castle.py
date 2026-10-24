"""Arrange every original model as part of one connected castle estate.
The generated JS is shared by client rendering, navigation and Cloudflare.
"""
from pathlib import Path
import json, math
ROOT=Path(__file__).resolve().parents[1]
models={f"{pack}/{m['id']}":m for pack in ['castle','dungeon'] for m in json.loads((ROOT/f'public/world/models/{pack}/manifest.json').read_text())['models']}
placed=[]
def p(pack,id,x,z,scale=1,y=0,turn=0,solid=True,zone=''):
 m=models[pack+'/'+id];w,h,d=m['size'];angle=turn*math.pi/180
 # Local dimensions are preserved uniformly, including quarter-turn placement.
 placed.append(dict(pack=pack,id=id,x=x,z=z,scale=scale,y=round(y,4),w=round((abs(math.cos(angle))*w+abs(math.sin(angle))*d)*scale,4),h=round(max(h,.005)*scale,4),d=round((abs(math.sin(angle))*w+abs(math.cos(angle))*d)*scale,4),turn=round(angle,8),solid=solid,zone=zone))
 return h*scale
K=lambda id,x,z,s=1,**kw:p('castle',id,x,z,s,**kw)
D=lambda id,x,z,s=1,**kw:p('dungeon',id,x,z,s,**kw)
# The north skyline is assembled from bases, midsections and roofs, rather than
# displaying each architecture piece separately on the ground.
towers=[
 (-44,['tower-hexagon-base','tower-hexagon-mid','tower-hexagon-top','tower-hexagon-roof']),
 (-33,['tower-base','tower-hexagon-top-wood','tower-hexagon-roof-secondary']),
 (-22,['tower-square-base-border','tower-square-mid','tower-square-top-color','tower-square-roof']),
 (-11,['tower-square-base-color','tower-square-mid-windows','tower-square-top-roof-high-windows']),
 (0,['tower-square-base','tower-square-mid-door','tower-square-top-roof-high']),
 (11,['tower-square','tower-square-mid-color','tower-square-top-roof-rounded']),
 (22,['tower-square-arch','tower-square-mid-open','tower-square-top-roof']),
 (33,['tower-square-base','tower-square-mid-open-simple','tower-square-top','tower-top']),
 (44,['tower-base','tower-slant-roof'])]
for x,ids in towers:
 y=0
 for id in ids:y+=K(id,x,-43,2.7,y=y,zone='NORTH TOWERS')
# Castle wall variations form broken garden partitions and village enclosures.
walls=['wall-corner-half-tower','wall-corner-half','wall-corner-slant','wall-corner','wall-half-modular','wall-half','wall-narrow-corner','wall-narrow-wood-fence','wall-narrow-wood','wall-pillar','wall-stud','wall-to-narrow','wall']
for id,x,z,turn in zip(walls,[-46,-41,-36,-46,-41,-36,-46,-41,-36,-22,-16,-10,-4],[-21,-21,-21,-13,-13,-13,-5,-5,-5,32,32,32,32],[0,0,90,0,90,0,90,0,0,0,0,0,0]):K(id,x,z,1.8,turn=turn,zone='OLD VILLAGE' if x<-30 else 'RUIN GARDEN')
# Two fenced, closed stair entries belong to the village buildings.
for id,x,z in [('wall-doorway',-44,7),('wall-narrow-gate',-36,7),('wall-narrow-stairs-rail',-44,15),('wall-narrow-stairs',-36,15),('wall-narrow',-40,20)]:K(id,x,z,2,zone='OLD VILLAGE')
K('door',-44,7,3.6,zone='OLD VILLAGE');K('metal-gate',-36,7,3.4,zone='OLD VILLAGE')
K('stairs-stone',-44,11,2.3,zone='OLD VILLAGE');K('stairs-stone-square',-36,11,2.3,zone='OLD VILLAGE')
for id,x,z,y in [('flag-banner-long',-43,-16,3.5),('flag-banner-short',-36,-16,3.0),('flag-pennant',-22,-43,7),('flag-wide',11,-43,7.3),('flag',44,-43,7)]:K(id,x,z,1.6,y=y,solid=False,zone='CASTLE BANNERS')
# West woodland has continuous gaps around trees, fallen timber and rocks.
for id,x,z,s in [('tree-large',-45,-30,3),('tree-small',-34,-28,2.6),('tree-log',-46,-35,2.7),('tree-trunk',-35,-35,2.5),('rocks-large',-40,-30,2.6),('rocks-small',-47,25,2.4),('ground-hills',-39,26,4.5)]:K(id,x,z,s,zone='WOODLAND')
# Abandoned timber machinery and its broken counterparts form the southern yard.
# These remain scenery; the escape has no combat or shooting mechanic.
for i,id in enumerate(['siege-ballista','siege-catapult','siege-ram','siege-tower','siege-trebuchet']):K(id,-22+i*10,42,1.65,turn=25 if i%2 else -20,zone='TIMBER YARD')
for i,id in enumerate(['siege-ballista-demolished','siege-catapult-demolished','siege-ram-demolished','siege-tower-demolished','siege-trebuchet-demolished']):K(id,-20+i*10,49,1.55,turn=-15 if i%2 else 20,zone='TIMBER YARD')
# Three original bridge pieces form one walkable crossing at ground level.
K('bridge-draw',32.6,20,3.2,y=-.28,solid=False,zone='STONE CROSSING')
for id,x in [('bridge-straight-pillar',35.8),('bridge-straight',39)]:K(id,x,20,3.44,y=-4.0054,solid=False,zone='STONE CROSSING')
K('ground',43,20,6,y=-.025,solid=False,zone='STONE CROSSING')
# A crypt and archive occupy the east side. Frames, furniture, floor tiles,
# closed gates, decoration and relics are placed in coherent room clusters.
D('arch',43,-9,1,zone='EAST CRYPT')
D('arch-door',43,-9,.98,zone='EAST CRYPT')
D('arch-door-bottompivot',47,-20,.82,turn=90,zone='EAST CRYPT')
D('arch-bars',35,-20,.88,turn=90,zone='EAST CRYPT')
D('decorative-wall',46,-29,1.8,zone='EAST CRYPT')
D('wall-modular',39,-29,1.8,zone='EAST CRYPT')
D('wallcover-modular',39,-29,1.8,y=3.61,solid=False,zone='EAST CRYPT')
D('column',34,-29,.8,zone='EAST CRYPT');D('column2',48,-29,.8,zone='EAST CRYPT')
D('banner',39,-29,.55,y=.8,solid=False,zone='EAST CRYPT');D('banner-wall',46,-29,.7,y=1.2,solid=False,zone='EAST CRYPT')
D('torch',36,-28,1.5,y=1.1,solid=False,zone='EAST CRYPT')
D('cobweb',47,-28,1.3,y=2.1,solid=False,zone='EAST CRYPT');D('cobweb2',40,-28,1.3,y=2.3,solid=False,zone='EAST CRYPT')
D('stairs-modular',43,-34,1,zone='CRYPT RUINS');D('stairs-sidecover',41.7,-34,1,zone='CRYPT RUINS');D('stairs-sidecoverwall',44.3,-34,1,zone='CRYPT RUINS')
D('brick',46,-34,1.5,zone='CRYPT RUINS')
for id,x,z,s in [('barrel',48,1,1.1),('barrel2',47,5,1),('crate',34,-1,1),('chair',36,4,1),('table-big',35,7,.9),('table-small',47,10,.9),('bucket',48,8,1.4),('bag-standing',33,6,2.8),('bag-coins',46,9,2),('woodfire',40,5,1.4),('vase',47,-1,2),('chest',34,-15,1.1),('chest-gold',47,-15,1.1),('coin-pile',47,-14,3),('skull',39,-27,1.5)]:D(id,x,z,s,zone='CRYPT CAMP')
D('pedestal',34,-24,.8,zone='EAST CRYPT');D('pedestal2',47,-24,.8,zone='EAST CRYPT')
D('statue-horse',40,-22,.8,zone='EAST CRYPT')
D('sword-wallmount',39,-28,1.4,y=1,solid=False,zone='EAST CRYPT')
for id,x,z,s in [('fence-90-modular',37,-35,1),('fence-end-modular',47,-35,1),('fence-straight-modular',40,-37,1)]:D(id,x,z,s,zone='CRYPT RUINS')
# The trap ruins have a clear route around their stone barriers.
for id,x,z in [('spikes',35,33),('trap-spikes',41,33),('trap-empty',47,33),('trapdoor',35,40),('trapdoor-open',41,40)]:D(id,x,z,1,zone='TRAP RUINS')
for id,x,z in [('floor-bricksseparate',34,26),('floor-bricksseparate2',43,26),('floor-modular',48,26)]:
 m=models['dungeon/'+id];D(id,x,z,2,y=-m['size'][1]*2,solid=False,zone='STONE CROSSING')
# A gate and a ground piece also exist in the playable castle. Include them in
# the authored estate data so every pack type is auditable from one plan.
K('gate',50,20,3.6,zone='OUTER GATE')
# Repeated source pieces knit the unique assets into a village, woodland,
# workshop and ruined crypt. They are contextual buildings and scenery.
for x,z in [(-44,-16),(-44,2),(-43,21)]:
 K('tower-square-mid-windows',x,z,3.6,zone='OLD VILLAGE')
 K('tower-square-top-roof-rounded',x,z,3.9,y=3.636,zone='OLD VILLAGE')
 K('flag-banner-short',x+1.8,z,1.5,y=1.2,solid=False,zone='OLD VILLAGE')
for x,z,scale in [(-49,-24,2.7),(-48,-29,2.1),(-46,-38,2.7),(-41,-37,2.4),(-36,-38,2.2),(-34,-32,2.4),(-36,-25,2.1),(-42,-26,2.3)]:K('tree-small',x,z,scale,zone='WOODLAND')
for i,(x,z) in enumerate([(-26,46),(-14,46),(-5,47),(5,46),(15,46),(24,45)]):
 K('tree-log',x,z,2.4,turn=90 if i%2 else 0,zone='TIMBER YARD')
 D('crate',x+1.5,z-1,1.0,zone='TIMBER YARD')
# Broken side walls frame the crypt, leaving its southern side and centre open.
for x in [34,40,46]:D('wall-modular',x,-32,1.2,zone='EAST CRYPT')
for x in [32,50]:
 for z in [-27,-21,-15]:D('wall-modular',x,z,1.2,turn=90,zone='EAST CRYPT')
missing=set(models)-{i['pack']+'/'+i['id'] for i in placed}
assert not missing,missing
regions=[
 dict(name='NORTH TOWERS',x=0,z=-43,w=102,d=17,color='#6b8171',entry=dict(x=0,z=-33)),
 dict(name='WOODLAND',x=-40,z=-28,w=21,d=20,color='#537f70',entry=dict(x=-31,z=-28)),
 dict(name='OLD VILLAGE',x=-40,z=7,w=21,d=31,color='#8d9072',entry=dict(x=-31,z=7)),
 dict(name='TIMBER YARD',x=0,z=43,w=59,d=19,color='#8e826b',entry=dict(x=0,z=34)),
 dict(name='EAST CRYPT',x=41,z=-22,w=21,d=28,color='#78738b',entry=dict(x=33,z=-10)),
 dict(name='STONE CROSSING',x=40,z=20,w=21,d=20,color='#718b83',entry=dict(x=30,z=20)),
 dict(name='TRAP RUINS',x=42,z=38,w=20,d=22,color='#837367',entry=dict(x=30,z=34)),
 dict(name='CRYPT CAMP',x=41,z=3,w=21,d=19,color='#948369',entry=dict(x=40,z=12))]
text='// Generated by tools/layout-complete-castle.py from both complete original manifests.\n'
text+='export const ESTATE_BOUNDS=52;\nexport const ESTATE_REGIONS='+json.dumps(regions,separators=(',',':'))+';\n'
text+='export const ENVIRONMENT_PLACEMENTS='+json.dumps(placed,separators=(',',':'))+';\n'
text+='export const ENVIRONMENT_KEYS='+json.dumps(sorted(models),separators=(',',':'))+';\n'
(ROOT/'public/world/castle-environment.js').write_text(text)
(ROOT/'.build/complete-world-placement.json').write_text(json.dumps(dict(regions=regions,placements=placed),indent=2))
print(f'{len(models)} / 124 model types placed in one estate; {len(placed)} placements across {len(regions)} connected regions.')
