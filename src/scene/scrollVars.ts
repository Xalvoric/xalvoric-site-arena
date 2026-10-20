// Writes one scroll-progress number into a CSS custom property. CSS does the
// drawing, so the page below the hero costs one ScrollTrigger and a single
// setProperty per update. Same ScrollTrigger the hero uses; progress only.
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/** Bind `el`'s `--b` (0..1) to how far `trigger` has travelled between `start` and `end`. Returns cleanup. */
export function bindProgress(el: HTMLElement, trigger: Element, start: string, end: string, prop = '--b') {
  const write = (p: number) => el.style.setProperty(prop, p.toFixed(4))
  const st = ScrollTrigger.create({
    trigger,
    start,
    end,
    onUpdate: (self) => write(self.progress),
    onRefresh: (self) => write(self.progress),
  })
  write(st.progress)
  return () => {
    st.kill()
    el.style.removeProperty(prop)
  }
}
