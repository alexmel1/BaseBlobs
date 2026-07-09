/**
 * High-fidelity, lightweight dynamic sound synthesis system using the Web Audio API.
 * This does not rely on external MP3/WAV assets, guaranteeing 100% offline support
 * and zero latency or bandwidth cost.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    // Standard AudioContext initialization with fallback
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  // Resume context if suspended (browser security policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a cute, bouncy, bubbly synth pop sound (perfect for tapping a blob!)
 */
export function playTapSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Create oscillator and gain node
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Triangle wave gives a cute, soft, retro-bouncy timbre
    osc.type = 'triangle';

    // Frequency sweep (starts low, shoots high to feel bouncy!)
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);

    // Cute fast decay envelope
    gainNode.gain.setValueAtTime(0.18, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.16);
  } catch (error) {
    console.warn('Audio context failed to play tap sound:', error);
  }
}

/**
 * Play a bright, sparkling, futuristic chime arpeggio (for expedition completion!)
 */
export function playExpeditionCompleteSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Sequence of notes in a beautiful major/pentatonic ascending chord (e.g. C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const noteDuration = 0.08;
    const spacing = 0.085;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Use a sine wave for crystal-clear purity, mixed with a triangle wave for texture
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * spacing);

      const noteStart = now + index * spacing;
      const noteEnd = noteStart + 0.22;

      // Sparkling envelope for each chime
      gainNode.gain.setValueAtTime(0, noteStart);
      gainNode.gain.linearRampToValueAtTime(0.12, noteStart + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, noteEnd);

      osc.start(noteStart);
      osc.stop(noteEnd + 0.02);
    });

    // Add an ambient sweet release laser pulse under the arpeggio
    const laserOsc = ctx.createOscillator();
    const laserGain = ctx.createGain();
    
    laserOsc.connect(laserGain);
    laserGain.connect(ctx.destination);
    
    laserOsc.type = 'sine';
    laserOsc.frequency.setValueAtTime(392.00, now); // G4
    laserOsc.frequency.exponentialRampToValueAtTime(880.00, now + 0.4);
    
    laserGain.gain.setValueAtTime(0.06, now);
    laserGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    laserOsc.start(now);
    laserOsc.stop(now + 0.52);

  } catch (error) {
    console.warn('Audio context failed to play expedition complete sound:', error);
  }
}

/**
 * Play a victorious, retro-modern ascending chime arpeggio (for level ups!)
 */
export function playLevelUpSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Sweet, upbeat pentatonic/major 7th sweep: C5 -> E5 -> G5 -> B5 -> C6 -> E6
    const chord = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51];
    const delay = 0.07;

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Mix sine waves for clarity and triangle waves for vintage game punchiness
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * delay);

      // Pitch vibrato for sparkly texture
      if (idx === chord.length - 1) {
        osc.frequency.linearRampToValueAtTime(freq + 15, now + idx * delay + 0.35);
      }

      const noteStart = now + idx * delay;
      const noteDuration = idx === chord.length - 1 ? 0.6 : 0.28;
      const noteEnd = noteStart + noteDuration;

      gainNode.gain.setValueAtTime(0, noteStart);
      gainNode.gain.linearRampToValueAtTime(0.14, noteStart + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, noteEnd);

      osc.start(noteStart);
      osc.stop(noteEnd + 0.02);
    });

    // Low rich undertone pad for depth
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(261.63, now); // C4
    subOsc.frequency.setValueAtTime(329.63, now + 0.2); // E4

    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    subOsc.start(now);
    subOsc.stop(now + 0.68);

  } catch (error) {
    console.warn('Audio context failed to play level up sound:', error);
  }
}

