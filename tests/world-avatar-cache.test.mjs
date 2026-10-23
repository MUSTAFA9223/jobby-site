import test from "node:test";
import assert from "node:assert/strict";
import {createAssetCache} from "../public/world/avatar-cache.js";

test("Remote avatars reuse downloads, retry failures and release pending loads once",async()=>{
  let loads=0,release;const disposed=[];
  const cache=createAssetCache(async key=>{loads++;if(key==="retry"&&loads===2)throw Error("offline");if(key==="pending")await new Promise(resolve=>release=resolve);return {key};},value=>disposed.push(value));
  const [a,b]=await Promise.all([cache.get("hero"),cache.get("hero")]);
  assert.equal(a,b);assert.equal(loads,1);
  await assert.rejects(cache.get("retry"),/offline/);await cache.get("retry");assert.equal(loads,3);
  const pending=cache.get("pending");await Promise.resolve();cache.close();cache.close();release();
  await assert.rejects(pending,/closed/);await Promise.resolve();
  assert.deepEqual(disposed.map(v=>v.key).sort(),["hero","pending","retry"]);
  await assert.rejects(cache.get("hero"),/closed/);
});
