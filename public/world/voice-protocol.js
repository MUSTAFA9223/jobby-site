// 80 ms mono PCM frames. Audio is relayed live; it is never written to storage.
export const VOICE_RATE=16000;
export const VOICE_SAMPLES=1280;
export const CLIENT_BYTES=3+VOICE_SAMPLES*2;
export const SERVER_BYTES=19+VOICE_SAMPLES*2;

export function clientFrame(pcm,sequence){
  if(!(pcm instanceof Int16Array)||pcm.length!==VOICE_SAMPLES)throw Error("Invalid audio frame");
  const data=new Uint8Array(CLIENT_BYTES),view=new DataView(data.buffer);
  data[0]=1;view.setUint16(1,sequence&65535);
  for(let i=0;i<pcm.length;i++)view.setInt16(3+i*2,pcm[i],true);
  return data.buffer;
}
export function relayFrame(buffer,id){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength!==CLIENT_BYTES||!/^[a-f0-9]{32}$/.test(id))return null;
  const input=new Uint8Array(buffer);if(input[0]!==1)return null;
  const output=new Uint8Array(SERVER_BYTES);output[0]=1;
  for(let i=0;i<16;i++)output[i+1]=parseInt(id.slice(i*2,i*2+2),16);
  output.set(input.subarray(1),17);return output.buffer;
}
export function readFrame(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength!==SERVER_BYTES)return null;
  const data=new Uint8Array(buffer);if(data[0]!==1)return null;
  const id=Array.from(data.subarray(1,17),x=>x.toString(16).padStart(2,"0")).join("");
  const view=new DataView(buffer),samples=new Float32Array(VOICE_SAMPLES);
  for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(19+i*2,true)/32768;
  return {id,sequence:view.getUint16(17),samples};
}
export class VoiceFramer{
  constructor(inputRate){this.inputRate=inputRate;this.phase=0;this.sum=0;this.count=0;this.frame=new Int16Array(VOICE_SAMPLES);this.offset=0;}
  push(samples){
    const frames=[];
    for(const value of samples){
      this.sum+=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;this.count++;this.phase+=VOICE_RATE;
      if(this.phase<this.inputRate)continue;
      const average=this.sum/this.count;this.sum=0;this.count=0;
      while(this.phase>=this.inputRate){
        this.phase-=this.inputRate;this.frame[this.offset++]=Math.round(average*(average<0?32768:32767));
        if(this.offset===VOICE_SAMPLES){frames.push(this.frame);this.frame=new Int16Array(VOICE_SAMPLES);this.offset=0;}
      }
    }
    return frames;
  }
}
