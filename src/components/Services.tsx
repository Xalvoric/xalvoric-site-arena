import { useEffect, useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { servicesIntro, services } from '../content/site'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { follow } from '../scene/follow'
import { bindProgress } from '../scene/scrollVars'
import { chapterAnchor, servicesAt, SVC_COUNT } from '../scene/servicesTimeline'
import { ServiceVisual } from './ServiceVisuals'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger)

/*
 * Keep these two in step with the `@media` block marked PINNED in styles.css.
 * Pinned: a wide, tall window. Everything else gets the same content in normal flow.
 */
const PINNED = '(min-width: 1000px) and (min-height: 760px)'
const FLOW = '(max-width: 999px), (max-height: 759px)'

const pad = (n: number) => String(n).padStart(2, '0')
/** Hand-off frame counter, in the spirit of the hero's HUD: 0 at the top of the section, 300 at the end. */
const FRAMES = 300

/**
 * "Three ways we help a business grow."
 *
 * One <ol> of three chapters. All the text is always in the document, in order.
 *  - Wide and tall screens: the stage pins (CSS `position: sticky`) and the chapters take turns on it,
 *    driven by one ScrollTrigger reading progress only. Each chapter's drawing builds from scroll.
 *  - Phones, tablets, short windows, reduced motion, no script: the same chapters stack in normal flow,
 *    each drawing building as it scrolls into view (or already complete when motion is off).
 */
export function Services() {
  const reduced = usePrefersReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  useServicesMotion(sectionRef, !reduced)

  return (
    <section ref={sectionRef} id="services" className="services" aria-labelledby="services-title">
      <div className="svc-track">
        <div className="svc-stage">
          <div className="svc-top">
            <header className="svc-head">
              <p className="eyebrow">{servicesIntro.eyebrow}</p>
              <h2 id="services-title" className="svc-title">
                {servicesIntro.title}
              </h2>
              <p className="section-lede svc-lede">{servicesIntro.lede}</p>
            </header>
            <nav className="svc-rail" aria-label={servicesIntro.railLabel}>
              <ol>
                {services.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>
                      <span className="svc-rail-n" aria-hidden="true">
                        {s.index}
                      </span>
                      {s.name}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <ol className="svc-chapters">
            {services.map((s) => (
              <li key={s.id} id={s.id} className="svc-chap">
                <div className="svc-copy">
                  <p className="svc-kicker">
                    <span aria-hidden="true">{s.index} / </span>
                    {s.kicker}
                  </p>
                  <h3 className="service-name">{s.name}</h3>
                  <p className="svc-outcome">{s.outcome}</p>
                  <p className="service-lede">{s.lede}</p>
                  <div className="svc-detail">
                    <h4 className="mini-label">What’s included</h4>
                    <ul className="tick-list">
                      {s.includes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <h4 className="mini-label">A good fit if</h4>
                    <p className="service-fit">{s.fit}</p>
                  </div>
                </div>
                <ServiceVisual id={s.id as 'web' | 'ai' | 'ads'} label={`Specimen ${s.index}`} />
              </li>
            ))}
          </ol>

          <div className="svc-fog" aria-hidden="true" />
          <div className="svc-hud" aria-hidden="true">
            <span className="svc-count">
              01 / {pad(SVC_COUNT)}  {services[0].name}
            </span>
            <span className="svc-bar-track">
              <span className="svc-bar" />
            </span>
            <span className="svc-frame">F 0000</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function useServicesMotion(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = document.documentElement
    if (!enabled) {
      // Reduced motion: the flow layout, every drawing complete, no script involved.
      delete root.dataset.svc
      return
    }
    const section = ref.current!
    const track = section.querySelector<HTMLElement>('.svc-track')!
    const stage = section.querySelector<HTMLElement>('.svc-stage')!
    const chapters = [...section.querySelectorAll<HTMLElement>('.svc-chap')]
    const railLinks = [...section.querySelectorAll<HTMLAnchorElement>('.svc-rail a')]
    const counter = section.querySelector<HTMLElement>('.svc-count')!
    const bar = section.querySelector<HTMLElement>('.svc-bar')!
    const frame = section.querySelector<HTMLElement>('.svc-frame')!
    const fine = window.matchMedia('(pointer: fine)').matches

    // Tells the stylesheet and the inline script in index.html that script is driving this section.
    root.dataset.svc = 'motion'
    root.dataset.svcLive = '1'
    const ids = services.map((s) => s.id)

    const mm = gsap.matchMedia()

    // --- pinned stage: one ScrollTrigger, progress only -----------------------
    mm.add(PINNED, () => {
      let target = 0
      let shown = -1
      let active = -1
      let last = performance.now()
      // Last value written per element and property, so an unchanged value costs nothing.
      const memo = new WeakMap<Element, Record<string, string>>()
      const put = (el: HTMLElement, name: string, v: number) => {
        const str = v.toFixed(4)
        const m = memo.get(el) ?? {}
        memo.set(el, m)
        if (m[name] === str) return
        m[name] = str
        el.style.setProperty(name, str)
      }

      const apply = (s: number) => {
        const st = servicesAt(s)
        put(stage, '--s', s)
        put(stage, '--intro', st.intro)
        put(stage, '--fog', st.fog)
        chapters.forEach((c, i) => {
          put(c, '--b', st.chapters[i].build)
          put(c, '--o', st.chapters[i].on)
        })
        bar.style.transform = `scaleX(${s.toFixed(4)})`
        frame.textContent = `F ${String(Math.round(s * FRAMES)).padStart(4, '0')}`
        if (st.active !== active) {
          active = st.active
          counter.textContent = `${pad(active + 1)} / ${pad(SVC_COUNT)}  ${services[active].name}`
          railLinks.forEach((a, i) => (i === active ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')))
        }
      }

      const trigger = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          target = self.progress
        },
        // After a resize or font load the picture is recomputed exactly, not eased.
        onRefresh: (self) => {
          target = self.progress
          shown = target
          apply(shown)
        },
      })
      target = trigger.progress
      shown = target
      apply(shown)

      // The hero uses the same follower, on the same ticker, so the page has one animation loop.
      const tick = () => {
        const now = performance.now()
        const dt = now - last
        last = now
        const next = fine ? follow(shown, target, dt) : target
        if (next !== shown) {
          shown = next
          apply(shown)
        }
      }
      gsap.ticker.add(tick)

      // In the pinned stage the chapters share one spot, so #web / #ai / #ads cannot be found by position.
      // Links to them (hero list, rail, bookmarks) go to the scroll position where that chapter is built.
      const jump = (i: number) => {
        window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * chapterAnchor(i), behavior: 'instant' })
        shown = target = trigger.progress
        apply(shown)
      }
      const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]')
        const i = a ? ids.indexOf(a.getAttribute('href')!.slice(1)) : -1
        if (i < 0) return
        e.preventDefault()
        jump(i)
        history.replaceState(null, '', `#${ids[i]}`)
        // Move the keyboard starting point to the chapter, as a normal in-page link would.
        const h = chapters[i].querySelector<HTMLElement>('.service-name')!
        h.tabIndex = -1
        h.focus({ preventScroll: true })
      }
      const onHash = () => {
        const i = ids.indexOf(window.location.hash.slice(1))
        if (i >= 0) jump(i)
      }
      document.addEventListener('click', onClick)
      window.addEventListener('hashchange', onHash)
      onHash() // arriving with #ai in the address

      return () => {
        document.removeEventListener('click', onClick)
        window.removeEventListener('hashchange', onHash)
        gsap.ticker.remove(tick)
        trigger.kill()
        ;[stage, ...chapters].forEach((el) => ['--s', '--intro', '--fog', '--b', '--o'].forEach((n) => el.style.removeProperty(n)))
        bar.style.transform = ''
        railLinks.forEach((a) => a.removeAttribute('aria-current'))
      }
    })

    // --- flow: each drawing builds as it scrolls into view ---------------------
    mm.add(FLOW, () => {
      const stops = chapters.map((c) => bindProgress(c, c.querySelector('.svc-visual')!, 'top 88%', 'top 38%'))
      return () => stops.forEach((stop) => stop())
    })

    return () => {
      mm.revert()
      delete root.dataset.svcLive
    }
  }, [ref, enabled])
}
