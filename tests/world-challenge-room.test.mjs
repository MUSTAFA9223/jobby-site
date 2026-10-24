import test from 'node:test';
import assert from 'node:assert/strict';
import * as challenge from '../challenge-room.js';
import * as race from '../race-room.js';

test('Timeout refunds the frozen roster even after every socket disconnects',async()=>{
 const room={code:'ABC234',status:'playing',race:race.newState(),challenge:challenge.newState()};
 room.challenge={...room.challenge,round:crypto.randomUUID(),status:'playing',entries:[{id:'a',team:'A'},{id:'b',team:'B'}]};room.race.deadline=Date.now()-1;
 const writes=[],messages=[],calls=[];
 const instance={ctx:{storage:{put:async(k,v)=>writes.push(structuredClone(v)),deleteAlarm:async()=>{}}},broadcast:m=>messages.push(m),playerStore:{fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({status:'refunded',winner:null,payouts:[{id:'a',points:100},{id:'b',points:100}]});}}};
 await challenge.update(instance,room);assert.equal(room.status,'finished');assert.equal(room.challenge.status,'refunded');assert.equal(calls[0].winner,null);assert.equal(writes[0].challenge.status,'settling','decision is persisted before refund');
 await challenge.update(instance,room);assert.equal(calls.length,1,'terminal result is never reapplied');assert.equal(messages.at(-1).state.challenge.status,'refunded');
});
test('A failed payout retries the saved winner rather than awarding another team',async()=>{
 const room={code:'ABC234',status:'playing',race:{...race.newState(),started:Date.now()-1000,deadline:Date.now()+100000,entries:{a:{finishAt:Date.now()},b:{finishAt:0}}},challenge:{...challenge.newState(),round:crypto.randomUUID(),status:'playing',entries:[{id:'a',team:'A'},{id:'b',team:'B'}]}};
 let fails=true,alarms=0;const winners=[];
 const instance={ctx:{storage:{put:async()=>{},deleteAlarm:async()=>{},setAlarm:async()=>alarms++}},broadcast(){},playerStore:{fetch:async(url,options)=>{winners.push(JSON.parse(options.body).winner);if(fails)throw Error('offline');return Response.json({status:'paid',winner:'A',payouts:[{id:'a',points:200}]});}}};
 await challenge.update(instance,room);assert.equal(room.challenge.status,'settling');assert.equal(alarms,1);
 room.race.entries.b.finishAt=Date.now();fails=false;await challenge.update(instance,room);assert.deepEqual(winners,['A','A']);assert.equal(room.challenge.status,'paid');
});

test('Crown victory and timeout share the same replay-safe pool settlement without race state',async()=>{
 const rules=await import('../public/world/party-rules.js');
 for(const win of [true,false]){
  const now=Date.now(),game=rules.newRound(4,now-1000,[{id:'a',team:'A'},{id:'b',team:'B'}]);
  if(win){Object.assign(game.actors.a,rules.CROWN);rules.applyAction(game,'a',{type:'crown'},now);Object.assign(game.actors.a,rules.BASES.A);rules.applyAction(game,'a',{type:'bank_crown'},now);}else game.deadline=now-1;
  const room={code:'ABC234',status:'playing',party:game,challenge:{...challenge.newState(70),round:crypto.randomUUID(),status:'playing',entries:[{id:'a',team:'A'},{id:'b',team:'B'}]}};
  const calls=[],events=[],instance={ctx:{storage:{put:async()=>{},deleteAlarm:async()=>{},setAlarm:async()=>{}}},broadcast:m=>events.push(m),playerStore:{fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({status:win?'paid':'refunded',winner:win?'A':null,payouts:[]});}}};
  await challenge.update(instance,room);assert.equal(calls.length,1);assert.equal(calls[0].winner,win?'A':null);assert.equal(room.status,'finished');assert.equal(events.at(-1).type,'party_state');assert.ok(events.at(-1).state.highlights);
 }
});
