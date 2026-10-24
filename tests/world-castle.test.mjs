import test from "node:test";
import assert from "node:assert/strict";
import * as map from "../public/world/castle-layout.js";
import * as rules from "../public/world/castle-rules.js";
const player=(id="a")=>({id,x:0,z:19,y:0,hidden:false});
function at(p,point){Object.assign(p,point);delete p.hold;}
function held(r,p,type,now,index){p.hold={type,index,at:now-2500};return rules.applyAction(r,p,{type,index},now,[p]);}
test("Castle destinations and twelve spawns are reachable without crossing solids",()=>{
 for(let slot=0;slot<12;slot++)assert.equal(map.blocked((slot%4-1.5)*1.5,18+Math.floor(slot/4)*1.5),false);
 for(const point of [...Object.values(map.STATIONS),...map.HIDES,...map.EXITS,...map.CRATE_SPAWNS]){
  assert.equal(map.blocked(point.x,point.z,.33),false,JSON.stringify(point));const route=map.route(map.SPAWN,point);assert.ok(route.length>1,JSON.stringify(point));for(const p of route)assert.equal(map.blocked(p.x,p.z,.4),false);
 }
});
test("Three linked puzzles require correct symbols, timed shutter, held fuse installation and correct cargo",()=>{
 const now=1000,r=rules.newRound(123,now,true),p=player();assert.deepEqual(r,rules.newRound(123,now,true));assert.notDeepEqual(r.code,rules.newRound(567,now,true).code);assert.equal("code" in rules.viewRound(r,now),false);
 at(p,map.EXITS[0]);assert.ok(rules.applyAction(r,p,{type:"finish"},now).error);
 at(p,map.STATIONS.panel);rules.applyAction(r,p,{type:"symbol",symbol:(r.code[0]+1)%4},now);assert.deepEqual(r.input,[]);assert.ok(r.noise);
 for(const symbol of r.code)rules.applyAction(r,p,{type:"symbol",symbol},now);assert.deepEqual(r.tasks,[0]);
 at(p,map.STATIONS.fuse);assert.ok(held(r,p,"fuse",now).error,"closed shutter blocks collection");
 at(p,map.STATIONS.lever);rules.applyAction(r,p,{type:"lever"},now);assert.equal(r.gateUntil,now+18000);
 at(p,map.STATIONS.fuse);held(r,p,"fuse",now+1000);assert.equal(r.fuse.owner,p.id);
 at(p,map.STATIONS.socket);assert.ok(rules.applyAction(r,p,{type:"install"},now+1500).error,"must hold button");held(r,p,"install",now+3000);assert.deepEqual(r.tasks,[0,1]);
 const wrong=r.crates.findIndex(c=>c.symbol!==r.target);at(p,r.crates[wrong]);held(r,p,"crate",now+4000,wrong);at(p,map.STATIONS.conveyor);assert.equal(held(r,p,"deliver",now+6000).wrong,true);assert.deepEqual(r.tasks,[0,1]);
 const right=r.crates.findIndex(c=>c.symbol===r.target);at(p,r.crates[right]);held(r,p,"crate",now+7000,right);at(p,map.STATIONS.conveyor);held(r,p,"deliver",now+9000);assert.deepEqual(r.tasks,[0,1,2]);assert.equal(r.contributions.a,30);
 at(p,map.EXITS[0]);assert.equal(rules.applyAction(r,p,{type:"finish"},now+10000).complete,true);assert.ok(rules.applyAction(r,p,{type:"finish"},now+11000).error);
});
test("Cargo is exclusive, catches keep solved tasks, rescue must be held and no player stays trapped",()=>{
 const r=rules.newRound(55,1000),a=player(),b=player("b");r.tasks=[0,1];const crate=r.crates[0];at(a,crate);held(r,a,"crate",2000,0);at(b,crate);assert.notEqual(rules.availableAction(r,b,2000)?.type,"crate");
 const caught=rules.catchPlayer(r,a,3000);assert.deepEqual(caught,map.JAIL);assert.equal(crate.owner,null);assert.deepEqual(r.tasks,[0,1]);
 at(b,map.JAIL);assert.ok(rules.applyAction(r,b,{type:"rescue"},4000,[a,b]).error);b.hold={type:"rescue",at:2000};assert.equal(rules.applyAction(r,b,{type:"rescue"},4100,[a,b]).rescued,"a");assert.equal(r.rescues.b,1);assert.equal(r.jailed.a,undefined);
 rules.catchPlayer(r,a,5000);assert.deepEqual(rules.tickRound(r,17000),["a"]);
 at(a,{x:-16,z:16});r.gateUntil=0;assert.equal(rules.availableAction(r,a,18000).type,"lever","emergency release inside cage");rules.applyAction(r,a,{type:"lever"},18000);assert.ok(r.gateUntil>18000);
 rules.tickRound(r,1000+map.ROUND_MS);assert.equal(r.failed,true);
});
test("Portcullis and guardian respect solid geometry; noise attracts investigation without microphone data",()=>{
 const r=rules.newRound(1,1000,true),g=map.newGuard();assert.equal(rules.isBlocked(r,map.DOOR.x,map.DOOR.z,1000),true);r.gateUntil=9000;assert.equal(rules.isBlocked(r,map.DOOR.x,map.DOOR.z,2000),false);
 r.noise={x:0,z:8,until:20000};for(let i=0;i<25;i++){rules.stepGuard(r,g,[],.1,2000+i*100);assert.equal(map.blocked(g.x,g.z,.39),false);}assert.equal(g.mode,"investigate");
});
