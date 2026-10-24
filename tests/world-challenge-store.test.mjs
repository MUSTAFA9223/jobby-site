import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const source=readFileSync(new URL('../player-store.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const WorldPlayers=new Function('DurableObject',source+'\nreturn WorldPlayers;')(class{constructor(ctx){this.ctx=ctx;}});
function store(){
 const db=new DatabaseSync(':memory:');let alarm=null;
 const sql={exec(query,...params){const stmt=db.prepare(query),rows=stmt.columns().length?stmt.all(...params):(stmt.run(...params),[]);return {toArray:()=>rows};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}},async setAlarm(at){alarm=at;},async deleteAlarm(){alarm=null;}};
 const players=new WorldPlayers({storage},{});
 const create=(key,points)=>{sql.exec('INSERT INTO players(key,id,name,state,created) VALUES(?,?,?,?,?)',key,randomUUID(),"Player",JSON.stringify({points,selected:'JOBBY',unlocked:[],history:[]}),Date.now());sql.exec('INSERT INTO sessions(id,player,created) VALUES(?,?,?)',key,key,Date.now());};
 const balance=key=>JSON.parse(players.get(key).state).points;
 return {players,sql,storage,create,balance,alarm:()=>alarm,close:()=>db.close()};
}
const body=async response=>({status:response.status,...await response.json()});
test('Challenge entry is atomic, requires unique funded profiles and rejects overlapping rounds',async t=>{
 const s=store();t.after(s.close);s.create('one',300);s.create('two',99);const round=randomUUID(),entries=[{id:'one',team:'A'},{id:'two',team:'B'}];
 let result=await body(await s.players.reserveChallenge({round,room:'ABC234',entries}));assert.equal(result.status,409);assert.equal(s.balance('one'),300);assert.equal(s.balance('two'),99);
 s.sql.exec('UPDATE players SET state=? WHERE key=?',JSON.stringify({points:300,history:[],selected:'JOBBY'}),'two');
 result=await body(await s.players.reserveChallenge({round,room:'ABC234',entries}));assert.equal(result.pot,200);assert.equal(s.balance('one'),200);assert.equal(s.balance('two'),200);assert.ok(s.alarm());
 await s.players.reserveChallenge({round,room:'ABC234',entries});assert.equal(s.balance('one'),200,'start replay cannot charge twice');
 result=await body(await s.players.reserveChallenge({round:randomUUID(),room:'DEF234',entries}));assert.equal(result.status,409);assert.equal(s.balance('one'),200);
 s.sql.exec('INSERT INTO sessions(id,player,created) VALUES(?,?,?)','alias','one',Date.now());
 result=await body(await s.players.reserveChallenge({round:randomUUID(),room:'DEF234',entries:[{id:'one',team:'A'},{id:'alias',team:'B'}]}));assert.equal(result.status,409);
});
test('The entire 2v2 pool is split equally, only winners rank in multiplayer, replay cannot repay',async t=>{
 const s=store();t.after(s.close);for(const id of ['a','b','c','d'])s.create(id,300);
 const round=randomUUID(),entries=['a','b','c','d'].map((id,i)=>({id,team:i<2?'A':'B'}));
 await s.players.reserveChallenge({round,room:'ABC234',entries});
 let paid=await body(await s.players.settleChallenge({round,winner:'A',seconds:42}));assert.equal(paid.status,'paid');assert.deepEqual(paid.payouts,[{id:'a',points:200},{id:'b',points:200}]);
 assert.equal(s.balance('a'),400);assert.equal(s.balance('b'),400);assert.equal(s.balance('c'),200);assert.equal(s.balance('d'),200);assert.equal(['a','b','c','d'].reduce((sum,id)=>sum+s.balance(id),0),1200,'no free points are minted from a challenge');
 assert.equal(s.players.view(s.players.get('a')).rankings.team.earned,200);assert.equal(s.players.view(s.players.get('a')).rankings.solo,undefined);
 paid=await body(await s.players.settleChallenge({round,winner:'B',seconds:1}));assert.equal(paid.winner,'A');assert.equal(s.balance('a'),400);assert.equal(s.balance('c'),200);assert.equal(s.alarm(),null);
});
test('No winner and orphaned expired entries refund every participant exactly once without ranking credit',async t=>{
 const s=store();t.after(s.close);s.create('a',100);s.create('b',100);const entries=[{id:'a',team:'A'},{id:'b',team:'B'}];
 const round=randomUUID();await s.players.reserveChallenge({round,room:'ABC234',entries});assert.equal(s.balance('a'),0);
 await s.players.settleChallenge({round,winner:null});await s.players.settleChallenge({round,winner:'A'});assert.equal(s.balance('a'),100);assert.equal(s.balance('b'),100);assert.deepEqual(s.players.view(s.players.get('a')).rankings,{});
 const orphan=randomUUID();await s.players.reserveChallenge({round:orphan,room:'ABC234',entries});s.sql.exec('UPDATE challenge_pots SET expires=? WHERE id=?',Date.now()-1,orphan);await s.players.alarm();assert.equal(s.balance('a'),100);assert.equal(s.balance('b'),100);assert.equal(s.alarm(),null);
});
test('Solo and multiplayer leaderboard queries stay isolated and never publish private profile keys',async t=>{
 const s=store();t.after(s.close);s.create('secret-a',300);s.create('secret-b',300);s.players.score('secret-a','solo',80,1,90);s.players.score('secret-b','team',200,1,42);
 for(const [mode,expected] of [['solo',80],['team',200]]){
  const response=await s.players.fetch(new Request('https://players.internal/api/world/leaderboard?mode='+mode));const data=await response.json();assert.equal(data.players.length,1);assert.equal(data.players[0].earned,expected);assert.ok(!JSON.stringify(data).includes('secret-'));
 }
});

test('Existing known solo/co-op history migrates once without changing balances',t=>{
 const s=store();t.after(s.close);s.create('old',340);
 const state=JSON.parse(s.players.get('old').state);state.history=[{points:80,seconds:50},{points:80,seconds:70,coop:true},{points:999,seconds:1,legacy:true}];s.sql.exec('UPDATE players SET state=? WHERE key=?',JSON.stringify(state),'old');s.sql.exec('DELETE FROM schema_updates');
 const migrated=new WorldPlayers({storage:s.storage},{});assert.equal(migrated.view(migrated.get('old')).rankings.solo.earned,80);assert.equal(migrated.view(migrated.get('old')).rankings.team.earned,80);assert.equal(s.balance('old'),340);
 new WorldPlayers({storage:s.storage},{});assert.equal(migrated.view(migrated.get('old')).rankings.team.earned,80,'migration replay cannot duplicate rankings');
});
test('1v1 and 3v3 distribute every contributed point equally',async t=>{
 for(const size of [1,3]){
  const s=store();t.after(s.close);const entries=Array.from({length:size*2},(_,i)=>({id:'p'+i,team:i<size?'A':'B'}));for(const e of entries)s.create(e.id,100);
  const round=randomUUID();await s.players.reserveChallenge({round,room:'ABC234',entries});const result=await body(await s.players.settleChallenge({round,winner:'B',seconds:40}));
  assert.equal(result.payouts.length,size);assert.ok(result.payouts.every(p=>p.points===200));assert.equal(entries.reduce((sum,e)=>sum+s.balance(e.id),0),size*200);
 }
});
