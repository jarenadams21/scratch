/**
 * Applies a 1950s/60s dictaphone-style Web Audio processing chain to an
 * HTMLAudioElement. Idempotent — safe to call on every play event.
 *
 * Chain: mono sum → highpass(300Hz) → lowpass(3.4kHz) → tape saturation
 *        → dynamics compressor ← tape hiss
 *                              ← vinyl crackle
 *        → output gain → destination
 *
 * Returns the AudioContext, or null if Web Audio is unavailable.
 */
export function applyVintageChain(audioEl) {
  if (audioEl._vintageCtx) return audioEl._vintageCtx;

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  try {
    const ctx = new AC();
    const src = ctx.createMediaElementSource(audioEl);

    // Mono down-mix — virtually all 1950s/60s recordings were mono
    const mono = ctx.createGain();
    mono.channelCount = 1;
    mono.channelCountMode = 'explicit';
    mono.channelInterpretation = 'speakers';

    // Bandwidth: 300 Hz – 3.4 kHz (dictaphone / telephone range)
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    hp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    lp.Q.value = 0.7;

    // Tape saturation — k=12 gives warm harmonic coloring without clipping the signal.
    // k=120 (previous) was near-square-wave clipping that destroyed speech intelligibility.
    const shaper = ctx.createWaveShaper();
    const n = 256, k = 12, satCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1;
      satCurve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
    }
    shaper.curve = satCurve;
    shaper.oversample = '4x';

    // Gentle tape compression
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 20;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.4;

    // Tape hiss — looped white noise buffer at low gain
    const sr = ctx.sampleRate;
    const hissBuf = ctx.createBuffer(1, sr * 3, sr);
    const hissData = hissBuf.getChannelData(0);
    for (let i = 0; i < hissData.length; i++) hissData[i] = Math.random() * 2 - 1;
    const hiss = ctx.createBufferSource();
    hiss.buffer = hissBuf;
    hiss.loop = true;
    hiss.start(0);
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.008;

    // Vinyl crackle — pre-generated sparse impulse buffer, looped
    const crackLen = sr * 8;
    const crackBuf = ctx.createBuffer(1, crackLen, sr);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) {
      if (Math.random() < 0.00015) {
        const len = 3 + Math.floor(Math.random() * 6);
        const amp = 0.12 + Math.random() * 0.2;
        for (let j = 0; j < len && i + j < crackLen; j++) {
          crackData[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / len);
        }
      }
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    crack.loop = true;
    crack.start(0);
    const crackGain = ctx.createGain();
    crackGain.gain.value = 0.015;

    // Gate cuts noise when the audio element is paused
    const noiseGate = ctx.createGain();
    noiseGate.gain.value = 0;
    const openGate  = () => noiseGate.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
    const closeGate = () => noiseGate.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    audioEl.addEventListener('play',  openGate);
    audioEl.addEventListener('pause', closeGate);
    audioEl.addEventListener('ended', closeGate);

    const out = ctx.createGain();
    out.gain.value = 1.1;

    // Speech chain — compressor never sees the noise
    src.connect(mono);
    mono.connect(hp);
    hp.connect(lp);
    lp.connect(shaper);
    shaper.connect(comp);
    comp.connect(out);

    // Noise mixes in at the output stage, after compression
    hiss.connect(hissGain);
    hissGain.connect(noiseGate);
    crack.connect(crackGain);
    crackGain.connect(noiseGate);
    noiseGate.connect(out);

    out.connect(ctx.destination);

    if (ctx.state === 'suspended') ctx.resume();
    audioEl._vintageCtx = ctx;
    return ctx;
  } catch (_) {
    // Web Audio unavailable or element already captured — caller falls back to plain playback
    return null;
  }
}
