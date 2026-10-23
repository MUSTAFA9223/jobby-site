import {ROOMS,SOLIDS,STATIONS,HIDES,SPAWN,EXITS,route} from "./warehouse-layout.js";
const $=id=>document.getElementById(id),svg=$("map"),ns="http://www.w3.org/2000/svg";
function shape(type,attrs,text,parent=svg){const el=document.createElementNS(ns,type);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);if(text)el.textContent=text;parent.append(el);return el;}
for(const r of ROOMS)shape("rect",{x:r.x-r.w/2,y:r.z-r.d/2,width:r.w,height:r.d,fill:r.color});
for(const b of SOLIDS)shape("rect",{x:b.x-b.w/2,y:b.z-b.d/2,width:b.w,height:b.d,fill:"#273849"});
const layer=shape("g",{});
for(const r of ROOMS)shape("text",{x:r.x,y:r.z+4,fill:"#fff2d6","font-size":1,"text-anchor":"middle","font-weight":850},r.name);
for(const h of HIDES)shape("circle",{cx:h.x,cy:h.z,r:.6,fill:"#a6c5ff"});
const stops=[{...STATIONS.clue,label:"READ",color:"#ffd369"},{...STATIONS.panel,label:"PANEL",color:"#ffd369"},{...STATIONS.lever,label:"LEVER",color:"#75dbff"},{...STATIONS.fuse,label:"FUSE",color:"#75dbff"},{...STATIONS.conveyor,label:"CARGO",color:"#b3f294"},{...STATIONS.jail,label:"RESCUE",color:"#ff92a7"},...EXITS.map(e=>({...e,label:"EXIT"}))];
for(const p of stops){shape("circle",{cx:p.x,cy:p.z,r:.8,fill:p.color});shape("text",{x:p.x,y:p.z-1.2,fill:p.color,"font-size":.9,"font-weight":900,"text-anchor":"middle"},p.label);}
shape("circle",{cx:SPAWN.x,cy:SPAWN.z,r:.8,fill:"#fff"});
const routes=[{label:"1 · SYMBOLS",points:[SPAWN,STATIONS.clue,STATIONS.panel],color:"#ffd369",note:"Visit the dispatch office, remember the three symbols, and enter them at the power-room panel. The sequence changes each round."},{label:"2 · FUSE",points:[STATIONS.panel,STATIONS.lever,STATIONS.fuse,STATIONS.socket],color:"#75dbff",note:"Operate the lever, pass through the shutter and take the fuse. Bring it to the power-room socket. There is an emergency release inside the secure cage."},{label:"3 · CARGO + EXIT",points:[STATIONS.socket,{x:12,z:-1},STATIONS.conveyor,EXITS[0]],color:"#b3f294",note:"This route shows one possible crate location. Check the dispatch board for the matching symbol, deliver the correct crate and head to the east gate."}];
const buttons=[];
function showMap(){ $("overview").classList.add("hidden");svg.classList.remove("hidden");$("overviewButton").setAttribute("aria-pressed","false");$("mapButton").setAttribute("aria-pressed","true"); }
for(const [i,r] of routes.entries()){
 const b=document.createElement("button");b.textContent=r.label;b.onclick=()=>{showMap();layer.replaceChildren();const points=r.points.flatMap((p,j)=>j?[...route(r.points[j-1],p)]:[p]);shape("polyline",{points:points.map(p=>p.x+","+p.z).join(" "),fill:"none",stroke:r.color,"stroke-width":.38,"stroke-linejoin":"round"},null,layer);$("routeNote").textContent=r.note;buttons.forEach((el,k)=>el.setAttribute("aria-pressed",String(i===k)));};buttons.push(b);$("routes").append(b);
}
$("mapButton").onclick=showMap;$("overviewButton").onclick=()=>{$("overview").classList.remove("hidden");svg.classList.add("hidden");$("overviewButton").setAttribute("aria-pressed","true");$("mapButton").setAttribute("aria-pressed","false");};
