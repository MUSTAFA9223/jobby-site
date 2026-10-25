import {Miniflare,convertV4MiniflareOptions} from "miniflare";
import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {AVATARS} from "../public/world/characters.js";
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:process.argv[2],compatibilityDate:"2026-10-01",durableObjects:{WORLD_ROOM:{className:"WorldRoom",useSQLite:true},WORLD_PLAYERS:{className:"WorldPlayers",useSQLite:true}}}));
const a=randomBytes(32).toString("hex"),b=randomBytes(32).toString("hex");
async function call(path,token,body,origin="https://game.test"){
 const res=await mf.dispatchFetch("https://game.test/api/world/"+path,{method:body===undefined?"GET":"POST",headers:{origin,authorization:"Bearer "+token,"content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:res.status,data:await res.json()};
}
let result=0;
try{
 let p=await call("profile/create",a,{name:"Mustafa",legacy:{points:330,unlocked:["Wizard"],selected:"Wizard"},history:[{seconds:45,points:80,date:Date.now(),character:"JOBBY"}]});
 assert.equal(p.status,200);assert.equal(p.data.state.points,330);assert.equal(p.data.state.history[0].legacy,true);const aid=p.data.id;
 assert.equal((await call("leaderboard")).data.players.length,0,"legacy balance never enters global ranks");
 await call("profile/create",b,{name:"Mustafa"});
 assert.equal((await call("profile",b)).data.state.points,0,"same name cannot open another save");
 assert.equal((await call("profile","0".repeat(64))).status,404);
 assert.equal((await call("profile/create",randomBytes(32).toString("hex"),{},"https://evil.test")).status,403);
 assert.equal((await call("profile/sync",b,{actions:[{type:"select",avatar:"__proto__"}]})).data.state.points,0);
 const locked=AVATARS.filter(a=>a.locked),c=randomBytes(32).toString("hex");
 let lockedProfile=await call("profile/create",c,{legacy:{points:1000000,selected:locked[0].id,unlocked:locked.map(a=>a.id)}});
 assert.equal(lockedProfile.data.state.selected,"JOBBY","imported saves cannot equip locked arrivals");
 assert.deepEqual(lockedProfile.data.state.unlocked,[],"forged ownership of new arrivals is discarded");
 lockedProfile=await call("profile/sync",c,{actions:locked.map(a=>({type:"select",avatar:a.id}))});
 assert.equal(lockedProfile.data.state.selected,"JOBBY","server rejects all 47 locked arrivals");
 assert.equal(lockedProfile.data.state.points,1000000,"locked previews cannot spend a player's points");
 const run=randomUUID(),actions=[{type:"start",run,map:"classic",at:Date.now()},{type:"task",run,index:0},{type:"task",run,index:1},{type:"task",run,index:2},{type:"finish",run}];
 p=await call("profile/sync",a,{actions});assert.equal(p.data.state.points,410);assert.equal(p.data.wins,1);
 p=await call("profile/sync",a,{actions});assert.equal(p.data.state.points,410,"replayed round earns nothing twice");assert.equal(p.data.wins,1);
 p=await call("profile/sync",a,{actions:[{type:"select",avatar:"Pirate_Female"},{type:"select",avatar:"Pirate_Female"},{type:"name",name:"<Mustafa>"}]});
 assert.equal(p.data.state.points,290,"unlock is charged once");assert.equal(p.data.name,"Mustafa");
 const otherRun=randomUUID();p=await call("profile/sync",b,{actions:[{type:"start",run:otherRun,map:"big-house-v1",at:Date.now()},{type:"finish",run:otherRun},{type:"select",avatar:"Wizard"}]});
 assert.equal(p.data.state.points,0);assert.equal(p.data.wins,0,"escape without tasks cannot earn points");assert.equal(p.data.errors.length,1);
 await call("profile/sync",b,{actions:[{type:"task",run:otherRun,index:1},{type:"task",run:otherRun,index:1},{type:"finish",run:otherRun}]});
 p=await call("profile",a);assert.equal(p.data.id,aid);assert.equal(p.data.state.points,290,"recovery code retrieves persisted balance independently of another player");
 const ranks=(await call("leaderboard")).data.players;assert.equal(ranks.length,2);assert.equal(ranks[0].id,aid);assert.equal(ranks[0].earned,80);assert.equal(ranks[1].earned,60);
 for(const row of ranks){assert.deepEqual(Object.keys(row).sort(),["best","earned","id","name","wins"]);assert.ok(!JSON.stringify(row).includes(a));}
 const offline=randomUUID();p=await call("profile/sync",b,{actions:[{type:"start",run:offline,map:"big-house-v1",at:Date.now()-60000},{type:"task",run:offline,index:0},{type:"finish",run:offline}]});
 assert.equal(p.data.state.points,120);assert.equal(p.data.state.history[0].offline,true);assert.equal(p.data.state.history[0].seconds,null,"offline delivery cannot create a false one-second record");
 console.log("Player saves runtime: separate identities, private recovery, legacy migration, idempotent rewards, purchases, names, offline timing and public rankings passed.");
}catch(error){console.error(error);result=1;}finally{await Promise.race([mf.dispose(),new Promise(resolve=>setTimeout(resolve,1000))]);}
process.exit(result);
