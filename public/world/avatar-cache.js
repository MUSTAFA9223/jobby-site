// Keep shared geometry/textures alive until every remote instance is removed.
export function createAssetCache(load,dispose){
  const entries=new Map();let closed=false;
  return {
    get(key){
      if(closed)return Promise.reject(Error("Avatar cache closed"));
      if(!entries.has(key)){
        const promise=Promise.resolve().then(()=>load(key)).then(value=>{
          if(closed){dispose(value);throw Error("Avatar cache closed");}
          return value;
        }).catch(error=>{if(entries.get(key)===promise)entries.delete(key);throw error;});
        entries.set(key,promise);
      }
      return entries.get(key);
    },
    close(){if(closed)return;closed=true;for(const promise of entries.values())void promise.then(dispose,()=>{});entries.clear();}
  };
}
