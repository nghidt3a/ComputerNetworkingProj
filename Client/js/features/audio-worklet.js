class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.maxBufferSamples = 16000 * 0.5; // ~500ms headroom at 16kHz

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type === "push" && data.samples) {
        const chunk = data.samples;
        const newLen = this.buffer.length + chunk.length;
        // If buffer grows beyond cap, drop oldest samples to keep latency bounded
        if (newLen > this.maxBufferSamples) {
          const drop = newLen - this.maxBufferSamples;
          if (drop >= this.buffer.length) {
            // drop all existing if overflow is huge
            this.buffer = new Float32Array(0);
          } else {
            this.buffer = this.buffer.slice(drop);
          }
        }
        const merged = new Float32Array(this.buffer.length + chunk.length);
        merged.set(this.buffer, 0);
        merged.set(chunk, this.buffer.length);
        this.buffer = merged;
      } else if (data.type === "clear") {
        this.buffer = new Float32Array(0);
      }
    };
  }

  process(inputs, outputs /*, parameters */) {
    const output = outputs[0];
    const channel = output[0];
    const frames = channel.length; // typically 128 frames per render quantum

    if (this.buffer.length >= frames) {
      channel.set(this.buffer.subarray(0, frames));
      this.buffer = this.buffer.slice(frames);
    } else {
      // Underflow: play what we have, fill rest with silence
      if (this.buffer.length > 0) {
        channel.set(this.buffer);
      }
      if (this.buffer.length < frames) {
        channel.fill(0, this.buffer.length);
      }
      this.buffer = new Float32Array(0);
    }

    // Mono output; if host requests more channels, mirror
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(output[0]);
    }

    return true; // keep processor alive
  }
}

registerProcessor("pcm-player", PCMPlayerProcessor);
