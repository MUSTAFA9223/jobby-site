import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
test("Bundled Kenney GLB assets include their own textures and original CC0 licenses",()=>{
 const root=fileURLToPath(new URL("../public/world/models/warehouse/",import.meta.url));
 for(const [pack,files] of Object.entries({factory:["conveyor-long-stripe.glb","machine.glb","lever-single.glb","box-small.glb","hopper-square.glb"],building:["column.glb","wall-doorway-wide-square.glb"]})){
  assert.match(readFileSync(join(root,pack+"-LICENSE.txt"),"utf8"),/Creative Commons Zero, CC0/);
  for(const name of files){const file=join(root,pack,name),bytes=readFileSync(file);assert.equal(bytes.toString("utf8",0,4),"glTF");assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString("utf8"));for(const image of model.images||[])if(image.uri)assert.ok(existsSync(join(dirname(file),image.uri)),file+" texture");}
 }
});
