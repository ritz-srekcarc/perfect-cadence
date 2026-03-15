export class AudioEngine {
  private ctx: AudioContext | null = null;
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  private metronomeOsc: OscillatorNode | null = null;
  private metronomeGain: GainNode | null = null;
  private metronomeInterval: number | null = null;
  private nextNoteTime: number = 0;
  private currentBeat: number = 0;
  private bpm: number = 0;
  
  private currentBinauralConfig: string = '';
  private currentMetronomeConfig: number = -1;
  
  private customAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string = '';

  constructor() {}

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.5;
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public stopAll() {
    this.stopBinaural();
    this.stopMetronome();
    this.stopCustomAudio();
    this.currentBinauralConfig = '';
    this.currentMetronomeConfig = -1;
  }

  public playBinaural(preset: string, customCarrier?: number, customBeat?: number, ampMod?: number) {
    const configKey = `${preset}-${customCarrier}-${customBeat}-${ampMod}`;
    if (this.currentBinauralConfig === configKey && this.leftOsc) return;
    this.currentBinauralConfig = configKey;

    this.init();
    this.stopBinaural();

    let carrier = 200;
    let beat = 10;

    switch (preset) {
      case 'focus':
        carrier = 400;
        beat = 15; // Beta
        break;
      case 'relax':
        carrier = 200;
        beat = 10; // Alpha
        break;
      case 'sleep':
        carrier = 100;
        beat = 2; // Delta
        break;
      case 'custom':
        carrier = customCarrier || 200;
        beat = customBeat || 10;
        break;
      case 'off':
      default:
        return;
    }

    if (!this.ctx || !this.masterGain) return;

    const merger = this.ctx.createChannelMerger(2);
    merger.connect(this.masterGain);

    this.leftOsc = this.ctx.createOscillator();
    this.rightOsc = this.ctx.createOscillator();
    this.leftGain = this.ctx.createGain();
    this.rightGain = this.ctx.createGain();

    this.leftOsc.type = 'sine';
    this.rightOsc.type = 'sine';

    this.leftOsc.frequency.value = carrier - beat / 2;
    this.rightOsc.frequency.value = carrier + beat / 2;

    this.leftOsc.connect(this.leftGain);
    this.rightOsc.connect(this.rightGain);

    this.leftGain.connect(merger, 0, 0); // Left channel
    this.rightGain.connect(merger, 0, 1); // Right channel

    if (ampMod && ampMod > 0) {
      this.leftGain.gain.value = 0.5;
      this.rightGain.gain.value = 0.5;
      
      this.lfo = this.ctx.createOscillator();
      this.lfoGain = this.ctx.createGain();
      this.lfo.type = 'sine';
      this.lfo.frequency.value = ampMod;
      this.lfoGain.gain.value = 0.5;
      this.lfo.connect(this.lfoGain);
      
      // Modulate amplitude
      this.lfoGain.connect(this.leftGain.gain);
      this.lfoGain.connect(this.rightGain.gain);
      this.lfo.start();
    } else {
      this.leftGain.gain.value = 1;
      this.rightGain.gain.value = 1;
    }

    this.leftOsc.start();
    this.rightOsc.start();
  }

  public stopBinaural() {
    if (this.leftOsc) {
      this.leftOsc.stop();
      this.leftOsc.disconnect();
      this.leftOsc = null;
    }
    if (this.rightOsc) {
      this.rightOsc.stop();
      this.rightOsc.disconnect();
      this.rightOsc = null;
    }
    if (this.lfo) {
      this.lfo.stop();
      this.lfo.disconnect();
      this.lfo = null;
    }
  }

  public playMetronome(bpm: number) {
    if (this.currentMetronomeConfig === bpm && this.metronomeInterval) return;
    this.currentMetronomeConfig = bpm;

    this.init();
    this.bpm = bpm;
    if (bpm <= 0) {
      this.stopMetronome();
      return;
    }

    if (!this.ctx) return;

    if (this.metronomeInterval) {
      window.clearInterval(this.metronomeInterval);
    }

    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.currentBeat = 0;

    this.metronomeInterval = window.setInterval(() => this.scheduler(), 25);
  }

  public stopMetronome() {
    if (this.metronomeInterval) {
      window.clearInterval(this.metronomeInterval);
      this.metronomeInterval = null;
    }
  }

  public playCustomAudio(url: string) {
    if (!url) {
      this.stopCustomAudio();
      return;
    }

    if (this.currentAudioUrl === url && this.customAudio) {
      if (this.customAudio.paused) {
        this.customAudio.play().catch(e => console.error("Error playing custom audio:", e));
      }
      return;
    }

    this.stopCustomAudio();

    this.currentAudioUrl = url;
    this.customAudio = new Audio(url);
    this.customAudio.loop = true;
    this.customAudio.play().catch(e => console.error("Error playing custom audio:", e));
  }

  public stopCustomAudio() {
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.currentTime = 0;
      this.customAudio = null;
    }
    this.currentAudioUrl = '';
  }

  public setVolume(value: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, value));
    }
    if (this.customAudio) {
      this.customAudio.volume = Math.max(0, Math.min(1, value));
    }
  }

  public getVolume(): number {
    return this.masterGain?.gain.value ?? 0.5;
  }

  private scheduler() {
    if (!this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
  }

  private nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat++;
    if (this.currentBeat === 4) {
      this.currentBeat = 0;
    }
  }

  private scheduleNote(beatNumber: number, time: number) {
    if (!this.ctx || !this.masterGain) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.value = beatNumber === 0 ? 880 : 440;
    
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.start(time);
    osc.stop(time + 0.1);
  }
}

export const audioEngine = new AudioEngine();
