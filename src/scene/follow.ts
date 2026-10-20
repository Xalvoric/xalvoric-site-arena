// One short exponential follower, shared by the hero and the pinned Services
// stage. It exists for one reason: a mouse wheel moves the page in 100 px
// notches, and drawing every notch as its own frame reads as stepping, not as
// a camera move. The follower closes the gap to the scroll position within a
// few frames and always ends exactly on it, so the resting picture is still a
// pure function of the scroll position.
//
// It is NOT a smooth-scroll layer: the page still scrolls natively and the
// scrollbar is never touched. Only the value the picture is drawn from lags,
// by about `tauMs`.

/** Time constant in ms. ~63% of a gap is closed after tauMs, ~95% after 3 x tauMs. 0 turns it off. */
export const SCROLL_DAMP_MS = 75

/** Gaps bigger than this (a click on a link, Home/End, a reload) jump straight to the target. */
const SNAP_ABOVE = 0.2

export function follow(current: number, target: number, dtMs: number, tauMs = SCROLL_DAMP_MS) {
  if (tauMs <= 0) return target
  const gap = target - current
  if (Math.abs(gap) > SNAP_ABOVE || Math.abs(gap) < 0.00025) return target
  // Frame-rate independent: the same real time closes the same share of the gap at 30, 60 or 120 fps.
  return current + gap * (1 - Math.exp(-Math.min(dtMs, 64) / tauMs))
}
