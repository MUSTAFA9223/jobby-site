import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";

const source=readFileSync(new URL("../public/world/player-profile.js",import.meta.url),"utf8").replace(/^export /gm,"")+"\nglobalThis.client={syncProfile,playerInfo,saveSelection,beginPlayerRun,recordPlayerTask,finishPlayerRun};";
test("Offline player events survive reload, retry without duplication and keep optimistic points until acknowledged",async()=>{
 const store=new Map([["jobby-world-v01",JSON.stringify({points:330,selected:"JOBBY",unlocked:[]})]]);
 let online=false,server=null,rewarded=new Set(),received=[];
 const fetch=async(url,options={})=>{
  if(!online)throw Error("offline");const body=options.body?JSON.parse(options.body):null;
  if(url.endsWith("/create"))server??={id:"test",name:body.name,earned:0,wins:0,state:{...body.legacy,history:body.history}};
  if(url.endsWith("/sync"))for(const a of body.actions){received.push(a.type);if(a.type==="task"&&!rewarded.has(a.id)){rewarded.add(a.id);server.state.points+=10;server.earned+=10;}if(a.type==="finish"&&!rewarded.has(a.id)){rewarded.add(a.id);server.state.points+=50;server.wins++;}}
  return {ok:true,json:async()=>structuredClone(server)};
 };
 function boot(){const context=vm.createContext({localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},crypto:webcrypto,fetch,AbortSignal,navigator:{},window:{addEventListener(){},dispatchEvent(){}},location:{reload(){}},Event, setInterval(){},console});vm.runInContext(source,context);return context.client;}
 let client=boot();await client.syncProfile();assert.match(client.playerInfo().status,/Offline/);
 client.beginPlayerRun("classic");client.recordPlayerTask(0);client.finishPlayerRun();await client.syncProfile();assert.equal(client.playerInfo().pending,3);
 store.set("jobby-world-v01",JSON.stringify({points:390,selected:"JOBBY",unlocked:[]}));
 // A navigation/reload must keep the private player identity and event queue.
 const name=client.playerInfo().name;client=boot();await client.syncProfile();assert.equal(client.playerInfo().name,name);assert.equal(client.playerInfo().pending,3);assert.equal(JSON.parse(store.get("jobby-world-v01")).points,390);
 online=true;await client.syncProfile();assert.equal(client.playerInfo().pending,0);assert.equal(JSON.parse(store.get("jobby-world-v01")).points,390);assert.deepEqual(received,["start","task","finish"]);
 await client.syncProfile();assert.equal(server.state.points,390);assert.equal(server.wins,1);
});
