// Pure, deterministic puzzle rules. Multiplayer accepts intentions, never client scores.
import * as map from "./castle-layout.js";
export const SYMBOLS=["SUN ☀","MOON ☾","STAR ★","CROWN ♛"];
const near=(a,b,r=1.85)=>map.near(a,b,r);
export function newRound(seed,now,solo=false){
 let value=seed>>>0;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
 const shuffled=[0,1,2,3];for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 return {seed,solo,started:now,deadline:now+map.ROUND_MS,tasks:[],code:shuffled.slice(0,3),target:shuffled[3],input:[],gateUntil:0,fuse:{owner:null,installed:false},crates:map.CRATE_SPAWNS.map(({x,z},i)=>({x,z,homeX:x,homeZ:z,symbol:(shuffled[3]+i)%4,owner:null})),jailed:{},contributions:{},rescues:{},captures:0,finished:false,failed:false,noise:null,lastProgress:now};
}
export function viewRound(r,now){return {started:r.started,deadline:r.deadline,serverNow:now,tasks:r.tasks,gateUntil:r.gateUntil,fuse:r.fuse,crates:r.crates,jailed:r.jailed,finished:r.finished,failed:r.failed};}
export function dropCargo(r,id){if(r.fuse.owner===id)r.fuse.owner=null;for(const c of r.crates)if(c.owner===id){c.owner=null;c.x=c.homeX;c.z=c.homeZ;}}
export function catchPlayer(r,p,now){
 if(r.jailed[p.id]||r.finished||r.failed)return;
 dropCargo(r,p.id);r.input=[];r.captures++;
 if(!r.solo)r.jailed[p.id]={until:now+12000,capture:r.captures};
 return {x:r.solo?map.SPAWN.x:map.JAIL.x,z:r.solo?map.SPAWN.z:map.JAIL.z};
}
export function tickRound(r,now){
 const freed=[];for(const [id,j] of Object.entries(r.jailed))if(now>=j.until){delete r.jailed[id];freed.push(id);}
 if(!r.finished&&now>=r.deadline)r.failed=true;
 return freed;
}
export function isBlocked(r,x,z,now,radius=.33){return map.blocked(x,z,radius)||(now>=r.gateUntil&&Math.abs(x-map.DOOR.x)<map.DOOR.w/2+radius&&Math.abs(z-map.DOOR.z)<map.DOOR.d/2+radius);}
export function availableAction(r,p,now){
 if(r.jailed[p.id])return {type:"jailed",label:"WAIT FOR RESCUE",ms:0};
 if(p.hidden)return {type:"unhide",label:"LEAVE HIDING",ms:0};
 for(const id of Object.keys(r.jailed))if(id!==p.id&&near(p,map.JAIL))return {type:"rescue",target:id,label:"RESCUE TEAMMATE",ms:2000};
 if(near(p,map.STATIONS.clue))return {type:"clue",label:"READ RUNE TABLET",ms:0};
 if(!r.tasks.includes(0)&&near(p,map.STATIONS.panel))return {type:"panel",label:"ENTER RUNE SEQUENCE",ms:0};
 if(!r.fuse.installed&&(near(p,map.STATIONS.lever)||(p.x<map.DOOR.x&&near(p,{x:map.DOOR.x-1,z:map.DOOR.z}))))return {type:"lever",label:r.solo?"OPEN VAULT · 18s":"HOLD VAULT OPEN",ms:0};
 const carrying=r.fuse.owner===p.id||r.crates.some(c=>c.owner===p.id);
 if(!carrying&&!r.fuse.installed&&!r.fuse.owner&&near(p,map.STATIONS.fuse)&&now<r.gateUntil)return {type:"fuse",label:"TAKE SUN CRYSTAL",ms:800};
 if(r.fuse.owner===p.id&&near(p,map.STATIONS.socket))return {type:"install",label:r.tasks.includes(0)?"PLACE SUN CRYSTAL":"SOLVE THE RUNE LOCK FIRST",ms:1800};
 if(r.tasks.includes(1)&&!r.tasks.includes(2)){
  if(r.crates.some(c=>c.owner===p.id)&&near(p,map.STATIONS.conveyor))return {type:"deliver",label:"PLACE ROYAL SEAL",ms:1800};
  if(!carrying){const index=r.crates.findIndex(c=>!c.owner&&near(p,c));if(index>=0)return {type:"crate",index,label:"TAKE "+SYMBOLS[r.crates[index].symbol]+" SEAL",ms:600};}
 }
 if(carrying)return {type:"drop",label:"PUT ITEM DOWN",ms:0};
 if(map.hideAt(p)>=0)return {type:"hide",label:"HIDE HERE",ms:0};
 return null;
}
export function applyAction(r,p,a,now,players=[]){
 tickRound(r,now);if(r.finished||r.failed)return {error:"The round has ended."};
 if(r.jailed[p.id]||p.y>.35)return {error:"You cannot do that here."};
 const contribution=index=>{if(!r.tasks.includes(index)){r.tasks.push(index);r.contributions[p.id]=(r.contributions[p.id]||0)+10;r.lastProgress=now;return index;}return null;};
 const noise=()=>{r.noise={x:p.x,z:p.z,until:now+6000};};
 if(a.type==="hint")return {note:r.tasks.length===0?"Find the rune tablet at the far end of the west labyrinth. Enter its three runes at the lock in the central hall.":r.tasks.length===1?"Open the Sun Vault in the west courtyard. Take the crystal before the portcullis closes, then place it on the central pedestal.":"Read the tablet for the royal seal. Carry the matching seal from the archive to the east altar, then escape through the east castle gate."};
 if(a.type==="finish"){
  if(map.exitAt(p,r.tasks)<0||p.hidden)return {error:"Solve all three puzzles, then reach the east castle gate."};
  r.finished=true;return {complete:true};
 }
 if(a.type==="symbol"){
  if(p.hidden||!near(p,map.STATIONS.panel)||r.tasks.includes(0)||!Number.isInteger(a.symbol)||a.symbol<0||a.symbol>3)return {error:"Stand by the rune lock."};
  r.input.push(a.symbol);
  if(r.code[r.input.length-1]!==a.symbol){r.input=[];noise();return {note:"Wrong rune! The alarm alerted the castle guardian.",wrong:true};}
  if(r.input.length===3){r.input=[];return {task:contribution(0),note:"Rune lock solved! Recover the Sun Crystal."};}
  return {note:"Rune accepted · "+r.input.length+" / 3"};
 }
 const action=availableAction(r,p,now);
 if(!action||action.type!==a.type||(a.type==="crate"&&action.index!==a.index))return {error:"Move closer to the objective."};
 if(p.hidden&&a.type!=="unhide")return {error:"Leave hiding first."};
 if(action.ms&&(p.hold?.type!==a.type||p.hold.index!==action.index||now-p.hold.at<action.ms-80))return {error:"Hold the action button until it fills."};
 if(a.type==="clue")return {clue:true,note:"RUNES: "+r.code.map(i=>SYMBOLS[i]).join(" → ")+" · SEAL: "+SYMBOLS[r.target]};
 if(a.type==="panel")return {panel:true};
 if(a.type==="lever"){r.gateUntil=now+(r.solo?18000:8000);noise();return {note:r.solo?"Vault open for 18 seconds — take the crystal!":"Vault open. Keep holding while your friend takes the crystal."};}
 if(a.type==="fuse"){r.fuse.owner=p.id;return {note:"Sun Crystal collected. Take it to the central pedestal."};}
 if(a.type==="install"){
  if(!r.tasks.includes(0))return {error:"Solve the rune lock first."};
  r.fuse.installed=true;r.fuse.owner=null;noise();return {task:contribution(1),note:"Sun Crystal restored! Find the matching royal seal."};
 }
 if(a.type==="crate"){r.crates[a.index].owner=p.id;return {note:"Carry this royal seal to the east altar. You move more slowly while carrying it."};}
 if(a.type==="drop"){dropCargo(r,p.id);return {note:"The item returned to its marked spot."};}
 if(a.type==="deliver"){
  const c=r.crates.find(c=>c.owner===p.id);c.owner=null;c.x=c.homeX;c.z=c.homeZ;
  if(c.symbol!==r.target){noise();return {note:"Wrong royal seal. Read the rune tablet again!",wrong:true};}
  noise();return {task:contribution(2),note:"Royal seal restored! The east castle gate is OPEN."};
 }
 if(a.type==="rescue"){
  const target=Object.keys(r.jailed).find(id=>id!==p.id&&players.some(x=>x.id===id));if(!target)return {error:"Nobody needs rescue."};
  delete r.jailed[target];r.rescues[p.id]=Math.min(3,(r.rescues[p.id]||0)+1);return {rescued:target,note:"Teammate rescued!"};
 }
 if(a.type==="hide"||a.type==="unhide")return {hidden:a.type==="hide"};
 return {};
}

export function stepGuard(r,g,players,dt,now){
 const old={x:g.x,z:g.z};if(r.noise)g.noise=r.noise;
 const eligible=players.filter(p=>!r.jailed[p.id]&&!(now>=r.gateUntil&&p.x<map.DOOR.x&&p.x>-23&&p.z>12&&p.z<20));
 const caught=map.advanceGuard(g,eligible,dt,now);
 if(isBlocked(r,g.x,g.z,now,.4)){g.x=old.x;g.z=old.z;g.path=[];return [];}
 return caught;
}
