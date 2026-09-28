import { typeChar, type TypingState } from '../../src/engine/typing'

/** Types `text` into the state, one key every `gapMs`, starting at `start`. Returns the state and the last timestamp. */
export function typeText(state: TypingState, text: string, gapMs = 200, start = 1_000_000): { state: TypingState; at: number } {
  let s = state
  let at = start
  for (const ch of text) {
    s = typeChar(s, ch, at)
    at += gapMs
  }
  return { state: s, at: at - gapMs }
}
