// Pure timing for the pinned Services stage. Progress `s` (0..1 over the
// section's scroll distance) goes in; CSS variable values come out. No DOM, no
// state: the same scroll position always produces the same picture.
import { clamp } from './timeline'

export const SVC_COUNT = 3
/** Share of the scroll spent on the big headline before chapter 1 takes over. */
export const SVC_INTRO = 0.14
/** Half-width of a dissolve between chapters, in progress units. */
const FADE = 0.035

const smooth = (t: number) => t * t * (3 - 2 * t)
const ramp = (p: number, a: number, b: number) => smooth(clamp((p - a) / (b - a), 0, 1))

const LEN = (1 - SVC_INTRO) / SVC_COUNT

/** Progress at which chapter `i` is fully on screen and built. Used for jump links. */
export const chapterAnchor = (i: number) => +(SVC_INTRO + LEN * (i + 0.6)).toFixed(4)

export type ServicesState = {
  /** 1 while the headline is large, easing to 0 as chapter 1 starts. */
  intro: number
  /** Peaks at 1 in the middle of each dissolve between chapters. */
  fog: number
  /** Chapter nearest the viewer, for the rail and the counter. */
  active: number
  chapters: { /** how much of its drawing is built */ build: number; /** visibility */ on: number }[]
}

export function servicesAt(s: number): ServicesState {
  const chapters: ServicesState['chapters'] = []
  let fog = 0
  for (let i = 0; i < SVC_COUNT; i++) {
    const a = SVC_INTRO + LEN * i
    const b = a + LEN
    const on = (i === 0 ? 1 : ramp(s, a - FADE, a + FADE)) * (i === SVC_COUNT - 1 ? 1 : 1 - ramp(s, b - FADE, b + FADE))
    // Drawing starts a little before the chapter arrives, so it is already forming as it fades in.
    const build = ramp(s, i === 0 ? 0 : a - 0.06, a + LEN * 0.55)
    chapters.push({ build, on })
    if (i > 0) fog = Math.max(fog, smooth(1 - clamp(Math.abs(s - a) / (FADE * 1.6), 0, 1)))
  }
  const active = s < SVC_INTRO ? 0 : clamp(Math.floor((s - SVC_INTRO) / LEN), 0, SVC_COUNT - 1)
  return { intro: 1 - ramp(s, 0.04, SVC_INTRO), fog, active, chapters }
}
