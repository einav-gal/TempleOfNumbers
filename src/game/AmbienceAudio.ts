/**
 * Subtle temple ambience, synthesized with WebAudio so no audio asset is
 * needed: looping brown noise through a low-pass filter reads as deep stone
 * rumble and distant air movement. A slow LFO drifts the filter cutoff so
 * the sound breathes instead of droning.
 *
 * Browsers only allow audio after a user gesture, so call start() from a
 * pointer event; repeated calls are no-ops.
 */
export default class AmbienceAudio {
  private ctx?: AudioContext;

  start(): void {
    if (this.ctx) {
      return;
    }
    this.ctx = new AudioContext();

    // 4 seconds of looping brown noise.
    const seconds = 4;
    const buffer = this.ctx.createBuffer(
      1,
      this.ctx.sampleRate * seconds,
      this.ctx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 0.7;

    // Slow drift of the cutoff: the "breathing" of the hall.
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 90;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    // Ease in so the rumble appears unnoticed.
    gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 6);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
    lfo.start();
  }
}
