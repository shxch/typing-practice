// Soft, synthesized sound effects (Web Audio, no audio files).
// Everything is quiet, rounded and short: sine/triangle tones through a low-pass filter
// with gentle attack and decay, so a few hundred keystrokes never get tiring.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let volume = 0.6

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = volume
    // A gentle low-pass takes the edge off every sound.
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4200
    master.connect(lp).connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, out: master! }
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v))
  if (master) master.gain.value = volume
}

interface Tone {
  freq: number
  /** Pitch the tone glides to (optional). */
  to?: number
  type?: OscillatorType
  gain: number
  attack?: number
  decay: number
  delay?: number
}

function tone({ freq, to, type = 'sine', gain, attack = 0.004, decay, delay = 0 }: Tone) {
  const a = audio()
  if (!a || volume === 0) return
  const t = a.ctx.currentTime + delay
  const osc = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + decay)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  osc.connect(g).connect(a.out)
  osc.start(t)
  osc.stop(t + attack + decay + 0.05)
}

/** C major pentatonic, two octaves up: every note sounds good next to every other. */
const PENTA = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0]

export type SoundStyle = 'phone' | 'keyboard' | 'kalimba' | 'wood'

let noise: AudioBuffer | null = null

/** A short burst of filtered noise: the "click" part of a key. */
function click(freq: number, q: number, gain: number, decay: number, highpass = 0) {
  const a = audio()
  if (!a || volume === 0) return
  if (!noise) {
    noise = a.ctx.createBuffer(1, Math.floor(a.ctx.sampleRate * 0.1), a.ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const t = a.ctx.currentTime
  const src = a.ctx.createBufferSource()
  src.buffer = noise
  const bp = a.ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = q
  const g = a.ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  if (highpass > 0) {
    const hp = a.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = highpass
    src.connect(hp).connect(bp).connect(g).connect(a.out)
  } else {
    src.connect(bp).connect(g).connect(a.out)
  }
  src.start(t)
  src.stop(t + decay + 0.02)
}

/** Kalimba walks up and down the pentatonic scale, so a run of correct keys makes a little tune. */
const KALIMBA = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 880.0, 784.0, 659.3, 587.3]
let kalimbaStep = 0

/** Correct key, in the chosen style. Space gets a slightly lower, rounder variant. */
export function playCorrect(style: SoundStyle = 'phone', isSpace = false) {
  const jitter = 1 + (Math.random() - 0.5) * 0.06
  if (style === 'phone') {
    // Phone-keyboard style (like a touch-screen keyboard's key click): a very short, dry,
    // bright "tick". Letters are crisp; space is a touch deeper, like the phone's modifier keys.
    // Synthesized here — not Apple's recording, which is copyrighted.
    if (isSpace) {
      tone({ freq: 760 * jitter, to: 620, type: 'triangle', gain: 0.1, attack: 0.001, decay: 0.022 })
      click(2300 * jitter, 1.1, 0.26, 0.016, 900)
    } else {
      tone({ freq: 1250 * jitter, to: 1050, type: 'triangle', gain: 0.07, attack: 0.001, decay: 0.016 })
      click(3300 * jitter, 1.2, 0.3, 0.012, 1500)
    }
  } else if (style === 'keyboard') {
    // A soft, muted "thock": low body + a quiet, dark click.
    const body = (isSpace ? 110 : 150) * jitter
    tone({ freq: body * 1.4, to: body, gain: 0.16, attack: 0.002, decay: 0.05 })
    click((isSpace ? 1200 : 1700) * jitter, 0.9, 0.18, 0.03)
  } else if (style === 'kalimba') {
    const f = (isSpace ? KALIMBA[0] / 2 : KALIMBA[kalimbaStep++ % KALIMBA.length])
    tone({ freq: f, gain: 0.07, attack: 0.003, decay: 0.35 })
    tone({ freq: f * 4.07, gain: 0.008, attack: 0.002, decay: 0.08 })
  } else {
    // Wood block: a short, hollow knock.
    const f = (isSpace ? 520 : 760) * jitter
    tone({ freq: f, type: 'triangle', gain: 0.1, attack: 0.001, decay: 0.045 })
    click(f * 2.2, 3, 0.06, 0.02)
  }
}

/** Backspace: the phone keyboard's slightly duller "delete" click. Only for the phone style. */
export function playDelete(style: SoundStyle) {
  if (style !== 'phone') return
  tone({ freq: 560, to: 470, type: 'triangle', gain: 0.1, attack: 0.001, decay: 0.028 })
  click(1800, 1, 0.24, 0.02, 700)
}

/** Wrong key: a low, muffled "boop" — noticeable, never harsh. */
export function playError() {
  tone({ freq: 220, to: 165, type: 'triangle', gain: 0.14, attack: 0.008, decay: 0.16 })
  tone({ freq: 110, gain: 0.05, attack: 0.008, decay: 0.12 })
}

/** Finished a round: a warm three-note bell arpeggio. */
export function playFinish() {
  ;[0, 2, 4].forEach((n, i) => {
    tone({ freq: PENTA[n] / 2, gain: 0.09, decay: 0.9, delay: i * 0.11 })
    tone({ freq: PENTA[n], gain: 0.025, decay: 0.5, delay: i * 0.11 })
  })
}

/** New key unlocked: a rising pentatonic sparkle. */
export function playUnlock() {
  PENTA.concat(PENTA.map((f) => f * 2)).forEach((f, i) => {
    tone({ freq: f, gain: 0.05, decay: 0.45, delay: 0.35 + i * 0.07 })
  })
}
