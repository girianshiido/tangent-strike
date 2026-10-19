import { SOUND_ASSETS } from './sound-assets.js';
export type Sound = keyof typeof SOUND_ASSETS;

/** Short, pre-rendered cues, decoded once and played without a media-element delay. */
export class SoundBank {
  private context: AudioContext | null = null;
  private buffers = new Map<Sound, Promise<AudioBuffer | null>>();
  private files = new Map<Sound, Promise<ArrayBuffer>>();
  private voices = new Set<AudioBufferSourceNode>();
  private generation = 0;
  private preferOgg = Boolean(document.createElement('audio').canPlayType('audio/ogg; codecs="opus"'));

  constructor(private enabled: () => boolean) {}

  private fetch(name: Sound, mp3 = false): Promise<ArrayBuffer> {
    const url = SOUND_ASSETS[name][!mp3 && this.preferOgg ? 'ogg' : 'mp3'];
    return fetch(new URL(url, document.baseURI)).then(response => {
      if (!response.ok) throw new Error('Sound unavailable');
      return response.arrayBuffer();
    });
  }

  preload() {
    if (!this.enabled()) return;
    for (const name of Object.keys(SOUND_ASSETS) as Sound[]) {
      if (!this.files.has(name)) {
        const file = this.fetch(name);
        // Keep rejected network requests handled until a later user gesture retries.
        void file.catch(() => {});this.files.set(name, file);
      }
    }
  }

  unlock() {
    if (!this.enabled()) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
      this.preload();
      for (const name of Object.keys(SOUND_ASSETS) as Sound[]) this.decode(name);
    } catch { /* Play remains available when device audio is unavailable. */ }
  }

  private decode(name: Sound): Promise<AudioBuffer | null> {
    if (!this.buffers.has(name)) {
      const context = this.context!;
      const ready = (this.files.get(name) ?? this.fetch(name))
        .then(data => context.decodeAudioData(data.slice(0)))
        .catch(() => this.fetch(name, true).then(data => context.decodeAudioData(data)))
        .catch(() => {this.files.delete(name);this.buffers.delete(name);return null;});
      this.buffers.set(name, ready);
    }
    return this.buffers.get(name)!;
  }

  play(name: Sound) {
    if (!this.enabled()) return;
    this.unlock();
    if (!this.context) return;
    const requested = performance.now(), generation = this.generation;
    void this.decode(name).then(buffer => {
      const context = this.context;
      if (!buffer || !context || !this.enabled() || generation !== this.generation || performance.now() - requested > 500 || context.state !== 'running') return;
      // Bound simultaneous voices when several targets are hit at once.
      if (this.voices.size >= 6) {
        const oldest = this.voices.values().next().value;
        if (oldest) {this.voices.delete(oldest);oldest.stop();}
      }
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;gain.gain.value = .58;
      source.connect(gain);gain.connect(context.destination);this.voices.add(source);
      source.onended = () => {this.voices.delete(source);source.disconnect();gain.disconnect();};
      source.start();
    });
  }

  stop() {
    this.generation++;
    for (const source of this.voices) source.stop();
    this.voices.clear();
  }
}
