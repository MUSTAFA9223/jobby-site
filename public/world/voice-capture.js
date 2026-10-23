import {VoiceFramer} from "./voice-protocol.js";
class VoiceCapture extends AudioWorkletProcessor{
  constructor(){super();this.encoder=new VoiceFramer(sampleRate);this.tail=0;}
  process(inputs){
    const input=inputs[0]?.[0];if(!input)return true;
    for(const frame of this.encoder.push(input)){
      let energy=0;for(const value of frame)energy+=value*value;
      if(Math.sqrt(energy/frame.length)>100)this.tail=6;
      if(this.tail>0){this.tail--;this.port.postMessage(frame.buffer,[frame.buffer]);}
    }
    return true;
  }
}
registerProcessor("jobby-voice-capture",VoiceCapture);
