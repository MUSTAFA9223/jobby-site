import test from "node:test";
import assert from "node:assert/strict";
import * as house from "../public/world/house-layout.js";

test("Twelve spawn slots, all rooms, tasks, hiding places and exits have safe routes",()=>{
 for(let slot=0;slot<12;slot++)assert.equal(house.blocked((slot%4-1.5)*1.5,18+Math.floor(slot/4)*1.5),false);
 for(const target of [...house.ROOMS.map(r=>({x:r.x,z:r.z+4})),...house.TASKS,...house.HIDES,...house.EXITS,...house.PATROL]){
  assert.equal(house.blocked(target.x,target.z),false,JSON.stringify(target));
  const path=house.route(house.SPAWN,target);assert.ok(path.length,"path to "+JSON.stringify(target));
  let previous=house.SPAWN;
  for(const p of path){
   assert.equal(house.blocked(p.x,p.z,.4),false);
   const n=Math.ceil(Math.hypot(p.x-previous.x,p.z-previous.z)*10);
   for(let i=0;i<=n;i++)assert.equal(house.blocked(previous.x+(p.x-previous.x)*i/n,previous.z+(p.z-previous.z)*i/n,.35),false,"route segment clearance");
   previous=p;
  }
  assert.ok(house.near(previous,target,1.2));
 }
});

test("Each exit needs its own task and hiding only works at designated furniture",()=>{
 for(const [i,exit] of house.EXITS.entries()){
  assert.equal(house.exitAt(exit,[]),-1);
  assert.equal(house.exitAt(exit,[(i+1)%3]),-1);
  assert.equal(house.exitAt(exit,[i]),i);
 }
 assert.equal(house.exitAt(house.SPAWN,[0,1,2]),-1);
 assert.equal(house.hideAt(house.SPAWN),-1);
 house.HIDES.forEach((spot,i)=>assert.equal(house.hideAt(spot),i));
});

test("Chef follows doors without crossing walls and ignores hidden/protected players",()=>{
 const guard=house.newGuard(),hidden={id:"hidden",x:0,z:-15,hidden:true},safe={id:"safe",x:0,z:-14,safeUntil:100000};
 house.advanceGuard(guard,[hidden,safe],.1,100);assert.equal(guard.target,null);
 const player={id:"runner",x:3,z:-15};
 house.advanceGuard(guard,[player],.1,200);assert.equal(guard.target,"runner");assert.equal(guard.mode,"chase");
 let caught=false;
 for(let t=300;t<5000;t+=100){if(house.advanceGuard(guard,[player],.1,t).includes(player.id))caught=true;assert.equal(house.blocked(guard.x,guard.z,.39),false);}
 assert.ok(caught);
 const patrol=house.newGuard();for(let t=0;t<180000;t+=100){house.advanceGuard(patrol,[],.1,t);assert.equal(house.blocked(patrol.x,patrol.z,.39),false);}
 assert.ok(patrol.waypoint>0,"patrol advances between rooms");
 assert.equal(house.visible({x:-10,z:-18},{x:0,z:-18}),false,"wall blocks chef sight");
});
