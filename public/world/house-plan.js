import {ROOMS,SOLIDS,TASKS,EXITS,HIDES,PATROL,SPAWN,route} from "./house-layout.js";
const svg=document.getElementById("floorplan"),ns="http://www.w3.org/2000/svg";
function shape(type,attrs,text){const node=document.createElementNS(ns,type);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);if(text)node.textContent=text;svg.append(node);return node;}
function line(points,color,width=.25,dash=""){return shape("polyline",{points:points.map(p=>p.x+","+p.z).join(" "),fill:"none",stroke:color,"stroke-width":width,"stroke-linejoin":"round","stroke-linecap":"round","stroke-dasharray":dash});}
for(const r of ROOMS){shape("rect",{x:r.x-r.w/2,y:r.z-r.d/2,width:r.w,height:r.d,fill:r.color,rx:.3,opacity:.85});shape("text",{x:r.x,y:r.z+2.6,fill:"#fff9e9","font-size":1.05,"text-anchor":"middle","font-weight":800},r.name);}
for(const b of SOLIDS)shape("rect",{x:b.x-b.w/2,y:b.z-b.d/2,width:b.w,height:b.d,fill:b.color||"#334054",rx:.08});
line([...PATROL,PATROL[0]],"#ff7585",.18,".4 .4");
const routeLayer=shape("g",{});
for(const h of HIDES)shape("circle",{cx:h.x,cy:h.z,r:.55,fill:"#a6c5ff",stroke:"#f0f5ff","stroke-width":.12});
for(const [i,t] of TASKS.entries()){
 shape("circle",{cx:t.x,cy:t.z,r:1,fill:t.color,stroke:"#26354c","stroke-width":.2});shape("text",{x:t.x,y:t.z+.4,fill:"#26354c","font-size":1.15,"font-weight":900,"text-anchor":"middle"},String(i+1));
 const e=EXITS[i];shape("rect",{x:e.x-1.3,y:e.z-.9,width:2.6,height:1.8,rx:.4,fill:e.color});
 shape("text",{x:e.x,y:e.z-1.6,fill:e.color,"font-size":.95,"text-anchor":"middle","font-weight":900},e.name);
}
shape("circle",{cx:SPAWN.x,cy:SPAWN.z,r:.8,fill:"#fff"});shape("text",{x:SPAWN.x,y:SPAWN.z+2,fill:"#fff","font-size":1,"text-anchor":"middle"},"START / SAFE YARD");
const buttons=TASKS.map((task,i)=>{
 const button=document.createElement("button");button.type="button";button.textContent=(i+1)+" · "+EXITS[i].name;button.onclick=()=>{showMap();choose(i);};document.getElementById("routes").append(button);return button;
});
function choose(i){
 routeLayer.replaceChildren();const points=[SPAWN,...route(SPAWN,TASKS[i]),...route(TASKS[i],EXITS[i])];
 const path=line(points,TASKS[i].color,.42);routeLayer.append(path);
 buttons.forEach((b,j)=>b.setAttribute("aria-pressed",String(i===j)));
 document.getElementById("routeNote").textContent=TASKS[i].room+": "+TASKS[i].action.toLowerCase()+" → "+EXITS[i].name.toLowerCase()+". Alternate doorways let you change course during a chase.";
}
choose(0);

function showMap(){document.getElementById("overview").classList.add("hidden");document.getElementById("plan").classList.remove("hidden");document.getElementById("showOverview").setAttribute("aria-pressed","false");document.getElementById("showFloorplan").setAttribute("aria-pressed","true");}
document.getElementById("showFloorplan").onclick=showMap;
document.getElementById("showOverview").onclick=()=>{document.getElementById("overview").classList.remove("hidden");document.getElementById("plan").classList.add("hidden");document.getElementById("showOverview").setAttribute("aria-pressed","true");document.getElementById("showFloorplan").setAttribute("aria-pressed","false");};
