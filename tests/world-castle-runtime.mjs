import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {Miniflare,convertV4MiniflareOptions} from "miniflare";
import * as map from "../public/world/castle-layout.js";
import {SYMBOLS} from "../public/world/castle-rules.js";
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:process.argv[2],compatibilityDate:"2026-10-01",durableObjects:{WORLD_ROOM:{className:"WorldRoom",useSQLite:true},WORLD_PLAYERS:{className:"WorldPlayers",useSQLite:true}}}));
const base="https://jobby.test",clients=[],pause=ms=>new Promise(r=>setTimeout(r,ms));let result=0;
async function wait(fn){for(let i=0;i<160;i++){if(fn())return;await pause(25);}throw Error("Castle WebSocket message timed out");}
async function api(path,token,body){const response=await mf.dispatchFetch(base+"/api/world/"+path,{method:body===undefined?"GET":"POST",headers:{origin:base,"content-type":"application/json",authorization:"Bearer "+token},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.ok(response.ok,"HTTP "+path+" "+response.status);return response.json();}
const send=(c,m)=>c.ws.send(JSON.stringify(m));
const latest=(c,type)=>c.messages.filter(m=>m.type===type).at(-1);
async function pose(c,p){await pause(145);send(c,{type:"pose",x:p.x,z:p.z,y:0,h:0,anim:"Walk"});await pause(40);}
async function act(c,action){await pause(155);send(c,{type:"castle_action",action});await pause(40);}
async function hold(c,p,action,ms){await pose(c,p);send(c,{type:"castle_hold"});await pause(ms+100);await act(c,action);}
try{
 const sessions=Array.from({length:12},(_,i)=>"castle-runtime-session-"+i+"-private"),tokens=[randomBytes(32).toString("hex"),randomBytes(32).toString("hex")];
 for(let i=0;i<2;i++){await api("profile/create",tokens[i],{name:"Castle runtime "+i});await api("profile/link",tokens[i],{session:sessions[i]});}
 const {code}=await api("rooms",null,{token:sessions[0],map:map.MAP_ID});
 async function connect(i){const response=await mf.dispatchFetch(base+`/api/world/rooms/${code}/socket?token=${sessions[i]}&avatar=JOBBY`,{headers:{upgrade:"websocket",origin:base}});assert.equal(response.status,101);const c={ws:response.webSocket,messages:[]};c.ws.accept();c.ws.addEventListener("message",e=>{if(typeof e.data==="string")c.messages.push(JSON.parse(e.data));});await wait(()=>latest(c,"welcome"));return c;}
 for(let i=0;i<12;i++)clients.push(await connect(i));
 let c=clients[0];send(c,{type:"start"});await wait(()=>clients.every(p=>latest(p,"start")?.castle));
 assert.equal(latest(c,"start").castle.tasks.length,0);assert.equal("code" in latest(c,"start").castle,false);
 await pose(clients[1],{x:-24,z:20});await pose(c,map.EXITS[0]);send(c,{type:"finish"});await pause(180);assert.equal(latest(c,"complete"),undefined);
 await pose(c,map.STATIONS.clue);await act(c,{type:"clue"});const clue=latest(c,"castle_note").note;assert.match(clue,/^RUNES:/);
 const [sequence,targetText]=clue.slice(7).split(" · SEAL: "),sequenceIds=sequence.split(" → ").map(s=>SYMBOLS.indexOf(s)),target=SYMBOLS.indexOf(targetText);assert.ok(sequenceIds.every(i=>i>=0));
 await pose(c,map.STATIONS.panel);for(const symbol of sequenceIds)await act(c,{type:"symbol",symbol});await wait(()=>latest(c,"castle_state")?.state.tasks.includes(0));
 // Intentions from afar and premature held actions are rejected.
 await act(c,{type:"fuse"});assert.equal(latest(c,"castle_state").state.fuse.owner,null);
 await pose(c,map.STATIONS.lever);await act(c,{type:"lever"});await hold(c,map.STATIONS.fuse,{type:"fuse"},800);assert.equal(latest(c,"castle_state").state.fuse.owner,latest(c,"welcome").selfId);
 await hold(c,map.STATIONS.socket,{type:"install"},1800);await wait(()=>latest(c,"castle_state").state.tasks.includes(1));
 const state=latest(c,"castle_state").state,index=state.crates.findIndex(c=>c.symbol===target),crate=state.crates[index];
 await hold(c,crate,{type:"crate",index},600);await hold(c,map.STATIONS.conveyor,{type:"deliver"},1800);await wait(()=>clients.every(p=>latest(p,"castle_state")?.state.tasks.length===3));
 // A game-page reconnect keeps shared puzzle progress and the same private player session.
 c.ws.close(1000,"Reconnect test");await pause(100);c=await connect(0);clients[0]=c;assert.deepEqual(latest(c,"welcome").castle.tasks,[0,1,2]);
 await pose(c,map.EXITS[0]);send(c,{type:"finish"});await wait(()=>clients.every(p=>latest(p,"complete")));
 let p=await api("profile",tokens[0]);assert.equal(p.state.points,80);assert.equal(p.wins,1);assert.equal(p.state.history[0].coop,true);
 p=await api("profile",tokens[1]);assert.equal(p.state.points,50,"active teammate gets their own saved reward");assert.equal(p.wins,1);
 send(c,{type:"finish"});await pause(180);assert.equal((await api("profile",tokens[0])).state.points,80,"finish replay cannot duplicate rewards");
 const ranks=await api("leaderboard");assert.equal(ranks.players.length,2,"AFK/unlinked sockets never create fake ranks");assert.equal(ranks.players[0].earned,80);assert.equal(ranks.players[1].earned,50);
 const hostId=latest(c,"welcome").hostId;const host=clients.find(p=>latest(p,"welcome").selfId===hostId);assert.ok(host);send(host,{type:"start"});await wait(()=>latest(c,"start"));assert.equal(latest(c,"start").castle.tasks.length,0,"same room can start a new randomized round");
 console.log("PASS: castle puzzles with twelve real sockets, private clues, held actions, shared progress across reconnect, active-player cloud rewards, replay protection and room restart.");
}catch(error){console.error(error);result=1;}finally{for(const c of clients)c.ws.close(1000,"Test complete");await Promise.race([mf.dispose(),pause(1000)]);}process.exit(result);
