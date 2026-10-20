import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { beats, callouts, FRAME_COUNT, layers, outline, SCROLL_LENGTH_VH, TILT } from '../scene/config'
import { follow } from '../scene/follow'
import { clamp, driftAt, opacityAt } from '../scene/timeline'
import { StillsRenderer } from '../scene/stillsRenderer'
import type { AnchorName, FrameState, HeroRenderer } from '../scene/renderer'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { hero } from '../content/site'
import { HeroCopy } from './HeroCopy'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
  // Mobile URL-bar show/hide changes the viewport height on every scroll;
  // don't recalculate trigger positions for that.
  ScrollTrigger.config({ ignoreMobileResize: true })
}

const BEAT_LABELS = ['Studio', 'Services', 'Begin']
/** Copy drifts this many px as a beat enters or leaves. */
const DRIFT_PX = 28
/** Callouts need the desktop two-column layout. */
const CALLOUT_MIN_WIDTH = 860

const easeOut = (t: number) => 1 - (1 - t) ** 3
const ramp = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1)

/** Hero entry point: cinematic scroll sequence, or a static stack when motion is reduced. */
export function ScrollScene() {
  const reduced = usePrefersReducedMotion()
  return reduced ? <StaticScene /> : <MotionScene />
}

/** WebGL is worth trying here (the renderer still checks it can create a context). */
function webglWanted() {
  const q = new URLSearchParams(window.location.search).get('gl')
  if (q === 'off') return false
  if (q === 'on') return true
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
  if (nav.connection?.saveData) return false
  if ((nav.deviceMemory ?? 8) < 4) return false
  if ((navigator.hardwareConcurrency || 8) < 4) return false
  return true
}

function MotionScene() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const stillsRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<HTMLCanvasElement>(null)
  const beatRefs = useRef<(HTMLDivElement | null)[]>([])
  const barRef = useRef<HTMLSpanElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef<HTMLSpanElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const section = sectionRef.current!
    const stage = stageRef.current!
    const stillsCanvas = stillsRef.current!
    const glCanvas = glRef.current!
    const svg = svgRef.current!

    /** What is drawn. Follows `target` (the real scroll progress) very closely; see scene/follow.ts. */
    let progress = 0
    /** Where the page is actually scrolled to. */
    let target = 0
    let lastTick = performance.now()
    let lastFrameNo = -1
    let dirty = true
    let disposed = false
    let activeBeat = -1
    const drift: number[] = beats.map(() => 0)

    // Overlay elements (queried once).
    const outlineGroup = svg.querySelector<SVGGElement>('.lines-outline')!
    const outlinePaths = [...svg.querySelectorAll<SVGPolylineElement>('.lines-outline polyline')]
    const plate = svg.querySelector<SVGEllipseElement>('.lines-outline ellipse')!
    const marksGroup = svg.querySelector<SVGGElement>('.lines-marks')!
    const marks = [...svg.querySelectorAll<SVGGElement>('.lines-mark')]
    const calloutGroup = svg.querySelector<SVGGElement>('.lines-callouts')!
    const calloutEls = [...svg.querySelectorAll<SVGGElement>('.lines-callout')]
    let t0 = performance.now()
    const settleEnd = outline.drawMs + outline.holdMs + 600

    // Pointer tilt: desktop with a precise pointer only.
    const fine = window.matchMedia('(pointer: fine)').matches && TILT.shiftX + TILT.shiftY > 0
    const mobile = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600
    let tiltX = 0
    let tiltY = 0
    let aimX = 0
    let aimY = 0

    // --- renderer: stills first, WebGL takes over when ready -----------------
    let renderer: HeroRenderer | null = null
    const makeStills = () => {
      try {
        return new StillsRenderer(stillsCanvas, {
          tilt: fine,
          onStatus: (st) => {
            if (st === 'failed' && renderer?.kind === 'webgl') return
            stage.dataset.media = st
          },
          onChange: () => {
            dirty = true
          },
        })
      } catch {
        stage.dataset.media = 'failed'
        return null
      }
    }
    renderer = makeStills()

    // --- sizing -----------------------------------------------------------
    let cssW = 1
    let cssH = 1
    let items: { x: number; y: number }[] = []
    const measureItems = () => {
      // Positions of the beat-2 service links, relative to the stage, without the current drift.
      const sr = stage.getBoundingClientRect()
      const links = beatRefs.current[1]?.querySelectorAll('.hero-list a') ?? []
      items = [...links].map((a) => {
        const r = a.getBoundingClientRect()
        return { x: r.left - sr.left, y: r.top - sr.top + r.height / 2 - drift[1] }
      })
    }
    const resize = () => {
      const rect = stage.getBoundingClientRect()
      cssW = rect.width
      cssH = rect.height
      renderer?.resize(cssW, cssH)
      svg.setAttribute('viewBox', `0 0 ${cssW.toFixed(1)} ${cssH.toFixed(1)}`)
      measureItems()
      dirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(stage)
    resize()

    // --- drawing ------------------------------------------------------------
    const frameState = (now: number): FrameState => {
      const t = now - t0
      return {
        p: progress,
        now,
        tiltX,
        tiltY,
        build: easeOut(clamp(t / outline.drawMs, 0, 1)),
        lineAlpha:
          (1 - 0.55 * ramp(t, outline.drawMs + outline.holdMs, settleEnd)) *
          (1 - ramp(progress, outline.fadeOut[0], outline.fadeOut[1])),
      }
    }

    const drawOverlay = (s: FrameState) => {
      const r = renderer
      if (!r) return
      // Outline (stills only; WebGL draws its own edge lines).
      const shape = s.lineAlpha > 0.001 ? r.outline(s) : null
      outlineGroup.style.opacity = shape ? s.lineAlpha.toFixed(3) : '0'
      if (shape) {
        shape.paths.forEach((pts, i) => {
          outlinePaths[i]?.setAttribute('points', pts)
          if (outlinePaths[i]) outlinePaths[i].style.strokeDashoffset = (1 - s.build).toFixed(3)
        })
        plate.setAttribute('cx', shape.plate.cx.toFixed(1))
        plate.setAttribute('cy', shape.plate.cy.toFixed(1))
        plate.setAttribute('rx', shape.plate.rx.toFixed(1))
        plate.setAttribute('ry', shape.plate.ry.toFixed(1))
        plate.style.strokeDashoffset = (1 - s.build).toFixed(3)
      }

      // Labels pinned to the monolith.
      marksGroup.style.opacity = s.lineAlpha.toFixed(3)
      if (s.lineAlpha > 0.001) {
        marks.forEach((m, i) => {
          const a = r.anchor(i === 0 ? 'mark0' : 'mark1', s)
          if (!a) return
          m.setAttribute('transform', `translate(${a[0].toFixed(1)} ${a[1].toFixed(1)})`)
          m.style.opacity = ramp(s.build, 0.6, 1).toFixed(3)
        })
      }

      // Callouts: service links in beat 2 tied to points on the monolith edge.
      const co = cssW >= CALLOUT_MIN_WIDTH ? opacityAt(beats[1].window, s.p) : 0
      calloutGroup.style.opacity = co.toFixed(3)
      if (co > 0.001) {
        calloutEls.forEach((el, i) => {
          const item = items[i]
          const a = r.anchor(`callout${i}` as AnchorName, s)
          if (!item || !a) return
          const [ax, ay] = a
          const iy = item.y + drift[1]
          const ix = item.x - 10 - s.tiltX * TILT.copyPx
          const line = el.querySelector('polyline')!
          line.setAttribute(
            'points',
            `${ax.toFixed(1)},${ay.toFixed(1)} ${(ix - 34).toFixed(1)},${iy.toFixed(1)} ${ix.toFixed(1)},${iy.toFixed(1)}`,
          )
          line.style.strokeDashoffset = (1 - co).toFixed(3)
          el.querySelectorAll('circle').forEach((c) => {
            c.setAttribute('cx', ax.toFixed(1))
            c.setAttribute('cy', ay.toFixed(1))
          })
        })
      }
    }

    /** Returns true if the renderer or a timed animation wants more frames. */
    const draw = (now: number) => {
      const s = frameState(now)
      const wants = renderer?.frame(s) ?? false

      // Copy blocks follow the same progress value.
      // The counter switches halfway between one beat leaving and the next arriving.
      let top = 0
      for (let i = 1; i < beats.length; i++) {
        if (progress >= (beats[i - 1].window[3] + beats[i].window[0]) / 2) top = i
      }
      const ops: number[] = []
      beats.forEach((b, i) => {
        const el = beatRefs.current[i]
        const op = opacityAt(b.window, progress)
        ops[i] = op
        drift[i] = driftAt(b.window, progress) * -DRIFT_PX
        if (!el) return
        el.style.opacity = op.toFixed(3)
        el.style.transform = `translate3d(${(-tiltX * TILT.copyPx).toFixed(1)}px, ${drift[i].toFixed(1)}px, 0)`
        el.toggleAttribute('data-live', op > 0.6)
      })
      // Side shades follow whichever copy block is showing; the veil takes the frame to page black at the end.
      stage.style.setProperty('--shade-r', Math.max(ops[0], ops[1]).toFixed(3))
      stage.style.setProperty('--shade-l', ops[2].toFixed(3))
      stage.style.setProperty('--veil', ramp(progress, 0.88, 1).toFixed(3))
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress.toFixed(4)})`
      const frameNo = Math.round(progress * FRAME_COUNT)
      if (frameNo !== lastFrameNo && frameRef.current) {
        lastFrameNo = frameNo
        frameRef.current.textContent = `F ${String(frameNo).padStart(4, '0')}`
      }
      if (top !== activeBeat && counterRef.current) {
        activeBeat = top
        counterRef.current.textContent = `0${top + 1} / 0${beats.length}  ${BEAT_LABELS[top]}`
      }
      drawOverlay(s)
      return wants || now - t0 < settleEnd
    }

    // Only animate continuously while the hero is on screen and the tab is visible.
    let inView = true
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting
      dirty = true
    })
    io.observe(section)

    // Frame-time guard: if WebGL can't keep up, fall back to the stills.
    let perfSamples: number[] = []
    let lastFrame = 0

    let animating = true
    const tick = () => {
      const nowMs = performance.now()
      const dt = nowMs - lastTick
      lastTick = nowMs
      // A mouse wheel moves the page in notches. The drawn progress closes on the real one within a few
      // frames and lands exactly on it, so the resting picture is unchanged. Touch scrolling is already
      // continuous and is drawn directly. Off-screen or hidden: no easing, just the real value.
      const next =
        fine && inView && document.visibilityState === 'visible' ? follow(progress, target, dt) : target
      if (next !== progress) {
        progress = next
        dirty = true
      }
      if (fine) {
        // Ease toward the pointer, then snap so the frame settles exactly.
        let nx = tiltX + (aimX - tiltX) * TILT.ease
        let ny = tiltY + (aimY - tiltY) * TILT.ease
        if (Math.abs(aimX - nx) < 0.002) nx = aimX
        if (Math.abs(aimY - ny) < 0.002) ny = aimY
        if (nx !== tiltX || ny !== tiltY) dirty = true
        tiltX = nx
        tiltY = ny
      }
      const live = inView && document.visibilityState === 'visible'
      if (!dirty && !(animating && live)) return
      dirty = false
      const now = performance.now()
      if (renderer?.kind === 'webgl' && live && perfSamples.length < 120) {
        if (lastFrame) perfSamples.push(now - lastFrame)
        lastFrame = now
        if (perfSamples.length === 120) {
          const sorted = perfSamples.slice(20).sort((a, b) => a - b)
          if (sorted[sorted.length >> 1] > 34) fallbackToStills()
        }
      }
      animating = draw(now)
    }
    gsap.ticker.add(tick)

    const fallbackToStills = () => {
      if (!renderer || renderer.kind !== 'webgl') return
      renderer.dispose()
      renderer = makeStills()
      renderer?.resize(cssW, cssH)
      stage.dataset.renderer = 'stills'
      dirty = true
    }

    // Load the WebGL scene after the page has loaded, so it never competes with first paint.
    let glStarted = false
    const startWebGL = () => {
      if (glStarted || disposed || !webglWanted()) return
      glStarted = true
      import('../scene/three/MonolithRenderer')
        .then(({ MonolithRenderer }) => {
          if (disposed) return
          const gl = new MonolithRenderer(glCanvas, { tilt: fine, mobile })
          gl.resize(cssW, cssH)
          t0 = performance.now()
          gl.frame(frameState(t0))
          const old = renderer
          renderer = gl
          stage.dataset.renderer = 'webgl'
          stage.dataset.media = 'ready'
          perfSamples = []
          lastFrame = 0
          animating = true
          dirty = true
          // Keep the stills underneath until the WebGL canvas has faded in.
          window.setTimeout(() => {
            if (renderer === gl) old?.dispose()
          }, 1000)
        })
        .catch(() => {
          // No WebGL or the chunk failed to load: the stills stay.
        })
    }
    const onLoad = () => {
      const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
      idle(startWebGL, { timeout: 2000 })
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    const onContextLost = (e: Event) => {
      e.preventDefault()
      fallbackToStills()
    }
    glCanvas.addEventListener('webglcontextlost', onContextLost)

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      aimX = (e.clientX / window.innerWidth) * 2 - 1
      aimY = (e.clientY / window.innerHeight) * 2 - 1
    }
    const onLeave = () => {
      aimX = 0
      aimY = 0
    }
    if (fine) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      document.documentElement.addEventListener('pointerleave', onLeave)
    }

    // --- scroll → progress (single source of truth) ------------------------
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        target = self.progress
        dirty = true
      },
      // After a resize, a font load or a reload the picture is recomputed exactly, not eased.
      onRefresh: (self) => {
        target = self.progress
        progress = target
        dirty = true
      },
    })
    target = st.progress
    progress = target
    document.fonts?.ready.then(() => {
      if (disposed) return
      ScrollTrigger.refresh()
      measureItems()
      dirty = true
    })

    // A viewport resize changes the section's pixel height. Keep the visitor on
    // the same moment of the sequence instead of the same pixel offset.
    let keep = -1
    const onRefreshInit = () => {
      keep = target > 0 && target < 1 ? target : -1
    }
    const onRefreshed = () => {
      if (keep < 0) return
      const y = st.start + (st.end - st.start) * keep
      keep = -1
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: 'instant' })
    }
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit)
    ScrollTrigger.addEventListener('refresh', onRefreshed)

    // Keyboard users: tabbing into a hidden beat scrolls the scene to it.
    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-beat]')
      if (!el) return
      const idx = Number(el.dataset.beat)
      if (opacityAt(beats[idx].window, progress) > 0.6) return
      const y = st.start + (st.end - st.start) * beats[idx].focusAt
      window.scrollTo({ top: y, behavior: 'instant' })
    }
    section.addEventListener('focusin', onFocusIn)

    return () => {
      disposed = true
      gsap.ticker.remove(tick)
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit)
      ScrollTrigger.removeEventListener('refresh', onRefreshed)
      st.kill()
      ro.disconnect()
      io.disconnect()
      section.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('load', onLoad)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      glCanvas.removeEventListener('webglcontextlost', onContextLost)
      renderer?.dispose()
      renderer = null
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="scene"
      style={{ height: `${SCROLL_LENGTH_VH}svh` }}
      aria-label="Introduction"
    >
      <div ref={stageRef} className="scene-stage" data-media="loading" data-renderer="stills">
        {/* Poster paints immediately; the stills canvas fades in over it, then WebGL (if available). */}
        <img
          className="scene-poster"
          src="/media/beat1-establish-1280.webp"
          alt=""
          fetchPriority="high"
          decoding="async"
          onError={(e) => {
            e.currentTarget.hidden = true
          }}
        />
        <canvas ref={stillsRef} className="scene-canvas scene-canvas--stills" role="img" aria-label={layers[0].alt} />
        <canvas ref={glRef} className="scene-canvas scene-canvas--gl" aria-hidden="true" />
        <div className="scene-scrim" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div className="scene-veil" aria-hidden="true" />

        {/* Decorative line work: outline build-in, labels, and service callouts (beat 2). */}
        <svg ref={svgRef} className="scene-lines" aria-hidden="true" focusable="false">
          <g className="lines-outline" style={{ opacity: 0 }}>
            {outline.paths.map((_, i) => (
              <polyline key={i} pathLength={1} />
            ))}
            <ellipse pathLength={1} />
          </g>
          <g className="lines-marks" style={{ opacity: 0 }}>
            {outline.marks.map((m) => (
              <g key={m.text} className="lines-mark" style={{ opacity: 0 }}>
                <circle r={2.5} />
                <line x1={0} y1={0} x2={m.side === 'left' ? -26 : 26} y2={-18} />
                <text x={m.side === 'left' ? -30 : 30} y={-22} textAnchor={m.side === 'left' ? 'end' : 'start'}>
                  {m.text}
                </text>
              </g>
            ))}
          </g>
          <g className="lines-callouts" style={{ opacity: 0 }}>
            {callouts.anchors.map((_, i) => (
              <g key={i} className="lines-callout">
                <circle className="lines-ring" r={9} />
                <circle r={2.5} />
                <polyline pathLength={1} />
              </g>
            ))}
          </g>
        </svg>

        <p className="scene-corner scene-corner--left" aria-hidden="true">
          {hero.corners.left}
        </p>
        <p className="scene-corner scene-corner--right" aria-hidden="true">
          {hero.corners.right}
        </p>

        {beats.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => {
              beatRefs.current[i] = el
            }}
            className={`scene-beat scene-beat--${b.id}`}
            data-beat={i}
            style={i === 0 ? undefined : { opacity: 0 }}
          >
            <HeroCopy beat={b.id} />
          </div>
        ))}

        <div className="scene-hud" aria-hidden="true">
          <span ref={counterRef} className="scene-counter">
            01 / 03  {BEAT_LABELS[0]}
          </span>
          <span className="scene-track">
            <span ref={barRef} className="scene-bar" />
          </span>
          <span ref={frameRef} className="scene-frame">
            F 0000
          </span>
          <span className="scene-hint">Scroll</span>
        </div>
      </div>
    </section>
  )
}

/** Reduced-motion hero: the same three frames and copy in normal document flow. */
function StaticScene() {
  return (
    <div className="static-scene">
      {beats.map((b, i) => (
        <section key={b.id} className={`static-beat static-beat--${b.id}`} aria-label={i === 0 ? 'Introduction' : undefined}>
          <img
            className="static-img"
            src={`${layers[i].src}-1280.webp`}
            srcSet={`${layers[i].src}-1280.webp 1280w, ${layers[i].src}-2048.webp 2048w`}
            sizes="100vw"
            alt={layers[i].alt}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
          <div className="static-copy">
            <HeroCopy beat={b.id} />
          </div>
        </section>
      ))}
    </div>
  )
}
