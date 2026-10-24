import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../public/world/party-rules.js';
const state=()=>r.newRound(41,1000,[{id:'a',name:'Alice',team:'A'},{id:'b',name:'Bob',team:'B'},{id:'c',name:'Cara',team:'A'},{id:'d',name:'Dan',team:'B'}]);
const at=(s,id,p)=>Object.assign(s.actors[id],p,{y:0});
test('Crown pickup, carrier speed, teammate passing and own-base victory are authoritative',()=>{
 const s=state();at(s,'a',r.CROWN);assert.equal(r.applyAction(s,'b',{type:'crown'},2000).error,'Move closer to this objective.');assert.equal(r.applyAction(s,'a',{type:'crown'},2000).milestone,0);assert.equal(s.crown.owner,'a');assert.equal(r.speed(s,'a',2000,true),3.1);
 at(s,'b',{x:0,z:-11});assert.ok(r.applyAction(s,'a',{type:'pass'},2500).error,'opponents cannot receive the crown');at(s,'c',{x:0,z:-11});assert.ok(!r.applyAction(s,'a',{type:'pass'},3000).error);assert.equal(s.crown.owner,'c');
 at(s,'c',r.BASES.B);assert.ok(r.applyAction(s,'c',{type:'bank_crown'},4000).error);at(s,'c',r.BASES.A);assert.equal(r.applyAction(s,'c',{type:'bank_crown'},5000).complete,true);assert.equal(s.winner,'A');assert.equal(s.highlights.awards[0].name,'Cara');assert.ok(r.applyAction(s,'c',{type:'bank_crown'},6000).error);
});
test('Mini passes a real narrow tunnel, expiration waits for clearance, giant pushes a collision crate',()=>{
 const s=state();at(s,'a',{x:-10,z:14});assert.equal(r.blocked(s,'a',-10,16,2000),true);assert.ok(!r.applyAction(s,'a',{type:'potion',potion:'mini'},2000).error);assert.equal(r.radius(s,'a',2000),.18);assert.equal(r.blocked(s,'a',-10,16,2000),false);
 const p=r.move(s,'a',-10,14,0,4,3000);assert.ok(p.z>17.9);at(s,'a',{x:-10,z:16});r.tick(s,15000);assert.equal(r.effect(s,'a',15000),'mini','mini never grows into an occupied tunnel');at(s,'a',{x:-10,z:14});r.tick(s,16000);assert.equal(r.effect(s,'a',16000),'normal');
 at(s,'c',{x:8,z:15});assert.ok(r.applyAction(s,'c',{type:'push'},2000).error);assert.ok(!r.applyAction(s,'c',{type:'potion',potion:'giant'},2000).error);assert.ok(!r.applyAction(s,'c',{type:'push'},3000).error);assert.equal(s.crate.x,15);assert.equal(s.crate.pushed,true);assert.equal(s.stocks.c.jelly,2);assert.equal(r.blocked(s,'c',15,15,3000),true);
});
test('Minute gates alternate while occupied passages stay open and disconnected ghosts cannot hold them',()=>{
 const s=state();assert.equal(r.gateOpen(s,0,2000),true);assert.equal(r.gateOpen(s,1,2000),false);r.tick(s,61001);assert.equal(r.gateOpen(s,0,61001),false);assert.equal(r.gateOpen(s,1,61001),true);
 at(s,'a',r.GATES[0]);r.tick(s,61050);assert.equal(r.gateOpen(s,0,61050),true);s.actors.a.connected=false;r.tick(s,61100);assert.equal(r.gateOpen(s,0,61100),false);s.actors.a.connected=true;at(s,'a',r.BASES.A);r.tick(s,61200);assert.equal(r.gateOpen(s,0,61200),false);
});
test('The cursed bag emits position noise, passes once and banks team protection; captures drop cargo',()=>{
 const s=state();at(s,'a',r.BAG);assert.ok(!r.applyAction(s,'a',{type:'bag'},2000).error);r.tick(s,2500);assert.equal(s.noise.x,r.BAG.x);assert.equal(s.noise.z,r.BAG.z);assert.equal(r.speed(s,'a',2500,true),4.6);
 at(s,'c',{x:-4,z:18});r.applyAction(s,'a',{type:'pass'},3000);assert.equal(s.bag.owner,'c');assert.equal(s.stats.a.passes,1);at(s,'c',r.TREASURE);r.applyAction(s,'c',{type:'bank_bag'},3500);assert.equal(s.bag.delivered,true);assert.equal(s.actors.a.safeUntil,18500);assert.ok(s.actors.b.safeUntil<18500);
 at(s,'a',r.CROWN);r.applyAction(s,'a',{type:'crown'},4000);s.actors.a.safeUntil=0;assert.equal(r.capture(s,'a',5000),true);assert.equal(s.crown.owner,null);assert.equal(s.crown.x,r.CROWN.x);assert.equal(s.actors.a.z,21);
});
test('Echo clues remain private and require a different player, with rune signals as a voice alternative',()=>{
 const s=state();at(s,'a',r.TABLET);const clue=r.applyAction(s,'a',{type:'read_echo'},2000);assert.equal(clue.private,true);assert.equal(clue.code.length,3);const publicState=r.publicView(s,2000);assert.equal('sequence' in publicState.echo,false);assert.equal('code' in publicState.echo,false);
 at(s,'a',r.LOCK);assert.ok(r.applyAction(s,'a',{type:'echo_symbol',symbol:clue.code[0]},2500).error);at(s,'c',r.LOCK);for(const symbol of clue.code)r.applyAction(s,'c',{type:'echo_symbol',symbol},3000);assert.equal(s.echo.solved.A,true);assert.ok(r.gateOpen(s,1,3000));
 assert.ok(!r.applyAction(s,'a',{type:'signal',index:clue.code[0]},4000).error);assert.match(s.signals[0].text,/SUN|MOON|STAR|CROWN/);assert.ok(r.applyAction(s,'a',{type:'signal',index:6},4100).error);assert.equal(s.stats.a.echoes,1);assert.equal(s.stats.c.echoes,1);
});
test('Potions have inventory, refill cooldowns, placement checks and no impossible giant growth',()=>{
 const s=state();assert.ok(r.applyAction(s,'a',{type:'potion',potion:'unknown'},2000).error);r.applyAction(s,'a',{type:'potion',potion:'jelly'},2000);assert.equal(s.stocks.a.jelly,0);assert.ok(r.applyAction(s,'a',{type:'potion',potion:'giant'},2100).error);
 at(s,'a',r.REFILLS[2]);r.applyAction(s,'a',{type:'refill'},5000);assert.equal(s.stocks.a.jelly,1);assert.ok(r.applyAction(s,'a',{type:'refill'},5100).error);
 at(s,'c',{x:-10,z:16});s.effects.c={type:'mini',until:9000};assert.ok(r.applyAction(s,'c',{type:'potion',potion:'giant'},5000).error);assert.equal(s.effects.c.type,'mini');assert.equal(s.stocks.c.giant,1);
});
test('Highlights are bounded movement clips and earned titles; timeout has no artificial winner',()=>{
 const s=state();s.guard={x:18,z:5,h:0,mode:'patrol'};for(let i=0;i<100;i++){s.actors.a.x+=.01;r.tick(s,1000+i*250,s.guard);}assert.equal(s.tracks.a.length,48);assert.equal(s.guardTrack.length,48);
 s.actors.a.safeUntil=0;r.capture(s,'a',27000);r.tick(s,s.deadline+1);assert.equal(s.finished,true);assert.equal(s.winner,null);assert.ok(s.highlights.clip.frames.length>1);assert.ok(s.highlights.clip.frames.length<=48);assert.ok(s.highlights.awards.some(a=>a.title==='WILDEST ADVENTURER'));assert.ok(!s.highlights.awards.some(a=>a.title==='BEST TEAMMATE'),'no fake teamwork award');
});
