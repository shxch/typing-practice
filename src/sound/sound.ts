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

/** Correct key: a soft, woody "pop" with a tiny random pitch so it never sounds mechanical. */
export function playCorrect(isSpace = false) {
  const base = isSpace ? 520 : 780 + Math.random() * 60
  tone({ freq: base * 1.6, to: base, gain: 0.07, decay: 0.07 })
  tone({ freq: base * 3, gain: 0.012, decay: 0.03 })
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
