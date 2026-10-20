// Procedural "specimen" drawings for the three services. Pure SVG + HTML, no
// image files and no WebGL. Every stroke reads one number, `--b` (how built the
// drawing is, 0..1), through CSS (see `.sv` in styles.css), so a drawing is a
// function of scroll position and nothing else. With `--b` unset (no script,
// reduced motion, prerender) CSS falls back to 1 and the drawing is complete.
//
// All of it is decorative (aria-hidden); the text beside it is the content.
import type { CSSProperties } from 'react'

/** Per-element delay: the drawing starts once `--b` passes this value (keep it <= 0.6). */
const at = (d: number, more?: CSSProperties) => ({ '--d': d, ...more }) as CSSProperties

/** A mono label placed by viewBox coordinates (640 x 400), so it tracks the drawing at any size. */
function Tag({ x, y, d, children, align = 'left' }: { x: number; y: number; d: number; children: string; align?: 'left' | 'right' | 'center' }) {
  const tx = align === 'right' ? '-100%' : align === 'center' ? '-50%' : '0'
  return (
    <span className="sv-tag" style={{ left: `${(x / 640) * 100}%`, top: `${(y / 400) * 100}%`, translate: `${tx} -50%`, ...at(d) }}>
      {children}
    </span>
  )
}

/** Corner ticks shared by all three drawings. */
function Ticks() {
  return (
    <>
      <path className="draw tick" pathLength={1} d="M14 34V14H34" style={at(0)} />
      <path className="draw tick" pathLength={1} d="M606 14H626V34" style={at(0)} />
      <path className="draw tick" pathLength={1} d="M626 366V386H606" style={at(0)} />
      <path className="draw tick" pathLength={1} d="M34 386H14V366" style={at(0)} />
    </>
  )
}

const svgProps = {
  viewBox: '0 0 640 400',
  focusable: 'false' as const,
  'aria-hidden': true as const,
  preserveAspectRatio: 'xMidYMid meet',
}

/** 01: a page wireframe that assembles line by line, then turns solid. */
function Web() {
  return (
    <>
      <svg {...svgProps}>
        <Ticks />
        <rect className="draw" pathLength={1} x={60} y={44} width={520} height={312} rx={10} style={at(0.02)} />
        <path className="draw" pathLength={1} d="M60 82H580" style={at(0.08)} />
        {[84, 100, 116].map((x, i) => (
          <circle key={x} className="draw" pathLength={1} cx={x} cy={63} r={4} style={at(0.1 + i * 0.02)} />
        ))}
        <path className="draw" pathLength={1} d="M420 63H448M464 63H492M508 63H536" style={at(0.14)} />
        {/* headline set in three bars */}
        <path className="draw bar" pathLength={1} d="M92 128H300" style={at(0.2)} />
        <path className="draw bar" pathLength={1} d="M92 150H262" style={at(0.24)} />
        <path className="draw bar" pathLength={1} d="M92 172H222" style={at(0.28)} />
        <path className="draw" pathLength={1} d="M92 206H282M92 222H252" style={at(0.32)} />
        <rect className="draw" pathLength={1} x={92} y={246} width={112} height={32} rx={16} style={at(0.36)} />
        <rect className="fill" x={92} y={246} width={112} height={32} rx={16} style={at(0.5, { '--fa': 0.9 } as CSSProperties)} />
        {/* image block */}
        <rect className="draw" pathLength={1} x={340} y={108} width={204} height={140} rx={6} style={at(0.3)} />
        <path className="draw" pathLength={1} d="M340 108L544 248M544 108L340 248" style={at(0.38)} />
        <rect className="fill" x={340} y={108} width={204} height={140} rx={6} style={at(0.55, { '--fa': 0.1 } as CSSProperties)} />
        {/* three cards */}
        {[92, 252, 412].map((x, i) => (
          <rect key={x} className="draw" pathLength={1} x={x} y={292} width={140} height={48} rx={6} style={at(0.42 + i * 0.05)} />
        ))}
        {/* build line sweeping down the page */}
        <path className="scan" d="M44 0H596" />
      </svg>
      <Tag x={60} y={380} d={0.2}>HEADER / HERO / GRID</Tag>
      <Tag x={580} y={380} d={0.45} align="right">TYPE, MOTION, BUILD</Tag>
    </>
  )
}

/** 02: an agent wired to its inputs and a human review step; pulses travel in as it is built. */
const AI_NODES: { x: number; y: number; label: string; human?: boolean; d: number }[] = [
  { x: 120, y: 96, label: 'TASK', d: 0.12 },
  { x: 120, y: 304, label: 'DATA', d: 0.18 },
  { x: 520, y: 96, label: 'TOOLS', d: 0.24 },
  { x: 520, y: 304, label: 'HUMAN REVIEW', human: true, d: 0.3 },
]

function Ai() {
  return (
    <>
      <svg {...svgProps}>
        <Ticks />
        <circle className="draw" pathLength={1} cx={320} cy={200} r={70} style={at(0.04)} />
        <circle className="draw" pathLength={1} cx={320} cy={200} r={44} style={at(0.08)} />
        <circle className="draw" pathLength={1} cx={320} cy={200} r={20} style={at(0.12)} />
        <circle className="fill" cx={320} cy={200} r={20} style={at(0.55, { '--fa': 0.95 } as CSSProperties)} />
        {AI_NODES.map((n) => {
          const dx = 320 - n.x
          const dy = 200 - n.y
          const len = Math.hypot(dx, dy)
          // Link from the node's edge to the agent's outer ring.
          const sx = n.x + (dx / len) * 12
          const sy = n.y + (dy / len) * 12
          const ex = 320 - (dx / len) * 70
          const ey = 200 - (dy / len) * 70
          const link = `M${sx.toFixed(1)} ${sy.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`
          return (
            <g key={n.label}>
              <path className="draw" pathLength={1} d={link} style={at(n.d)} />
              <path className="pulse" pathLength={1} d={link} style={at(n.d + 0.1)} />
              {n.human ? (
                <rect className="draw" pathLength={1} x={n.x - 10} y={n.y - 10} width={20} height={20} rx={3} style={at(n.d)} />
              ) : (
                <circle className="draw" pathLength={1} cx={n.x} cy={n.y} r={10} style={at(n.d)} />
              )}
            </g>
          )
        })}
      </svg>
      {AI_NODES.map((n) => (
        <Tag key={n.label} x={n.x} y={n.y + (n.y < 200 ? -26 : 26)} d={n.d + 0.15} align="center">
          {n.label}
        </Tag>
      ))}
      <Tag x={320} y={296} d={0.5} align="center">AGENT</Tag>
    </>
  )
}

/** 03: one subject, cut to the formats ads run in. The frames slide out of a single square. */
const AD_FRAMES = [
  { id: 'story', w: 110, h: 196, x: -185, label: 'STORY 9:16', s: 0.9 },
  { id: 'feed', w: 150, h: 150, x: 0, label: 'FEED 1:1', s: 0.8 },
  { id: 'wide', w: 200, h: 112, x: 195, label: 'WIDE 16:9', s: 0.62 },
]

function Ads() {
  return (
    <>
      <svg {...svgProps}>
        <Ticks />
        {AD_FRAMES.map((f, i) => (
          <g key={f.id} className="ad-frame" style={{ '--x': f.x } as CSSProperties}>
            <rect className="draw" pathLength={1} x={-f.w / 2} y={-f.h / 2} width={f.w} height={f.h} rx={6} style={at(0.04 + i * 0.05)} />
            {/* the studio's own monolith, cropped differently in each frame */}
            <g transform={`scale(${f.s})`}>
              <path className="draw" pathLength={1} d="M-16 44L-12 -24L0 -44L12 -24L16 44Z" style={at(0.2 + i * 0.05)} />
              <path className="draw" pathLength={1} d="M0 -44V44M-12 -24H12" style={at(0.3 + i * 0.05)} />
              <ellipse className="draw" pathLength={1} cx={0} cy={44} rx={26} ry={4} style={at(0.36 + i * 0.05)} />
            </g>
          </g>
        ))}
      </svg>
      {AD_FRAMES.map((f) => (
        <Tag key={f.id} x={320 + f.x} y={200 + f.h / 2 + 22} d={0.55} align="center">
          {f.label}
        </Tag>
      ))}
    </>
  )
}

const BY_ID = { web: Web, ai: Ai, ads: Ads } as const

/** The framed drawing for one service. `id` is the service id in content/site.ts. */
export function ServiceVisual({ id, label }: { id: keyof typeof BY_ID; label: string }) {
  const Drawing = BY_ID[id]
  return (
    <div className={`svc-visual sv sv-${id}`} aria-hidden="true">
      <Drawing />
      <span className="sv-corner sv-corner--tl">{label}</span>
    </div>
  )
}
