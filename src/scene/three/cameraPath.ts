// Camera keyframes for the WebGL monolith, in hero scroll progress (0–1).
// The camera is one continuous move: between keys it follows a monotone cubic
// (Fritsch–Butland tangents), so its velocity is continuous through every key
// instead of dropping to zero and restarting, which is what read as stepping.
// It only slows to a stop where a value genuinely turns round (the closest
// approach in beat 2), and it never overshoots a key.
//
// ox / oy shift the subject on screen without moving the camera (a view
// offset, as a fraction of the viewport): positive ox pushes the monolith
// left, positive oy pushes it up. Use them to keep the copy area clear.

export type CamKey3 = {
  p: number
  pos: [number, number, number]
  look: [number, number, number]
  fov: number
  ox: number
  oy: number
}

export const desktopPath: CamKey3[] = [
  { p: 0, pos: [5.2, 1.7, 14.6], look: [0, 3.1, 0], fov: 30, ox: 0.1, oy: 0 },
  { p: 0.26, pos: [3.6, 2.8, 9], look: [0, 3.4, 0], fov: 30, ox: 0.1, oy: 0 },
  { p: 0.44, pos: [4.4, 4.3, 2.4], look: [0.3, 3.8, 0.3], fov: 34, ox: 0.14, oy: 0 },
  { p: 0.6, pos: [4.1, 3.7, 2.5], look: [0.32, 3.6, 0.32], fov: 34, ox: 0.14, oy: 0 },
  { p: 0.78, pos: [-4, 6.2, 15.5], look: [0, 3, 0], fov: 30, ox: -0.13, oy: 0 },
  { p: 1, pos: [-3.4, 4.4, 19], look: [0, 3, 0], fov: 28, ox: -0.13, oy: 0 },
]

/** Phones: pull back a little and lift the subject above the bottom-anchored copy. */
export const portraitPath: CamKey3[] = [
  { p: 0, pos: [7, 2.2, 19.8], look: [0, 3.1, 0], fov: 34, ox: 0, oy: 0.1 },
  { p: 0.26, pos: [5, 3.0, 13.2], look: [0, 3.4, 0], fov: 34, ox: 0, oy: 0.12 },
  { p: 0.44, pos: [5.2, 4.5, 3.0], look: [0.3, 3.8, 0.3], fov: 38, ox: 0, oy: 0.2 },
  { p: 0.6, pos: [4.9, 3.9, 3.0], look: [0.32, 3.6, 0.32], fov: 38, ox: 0, oy: 0.2 },
  { p: 0.78, pos: [-4, 6.6, 21], look: [0, 3, 0], fov: 34, ox: 0, oy: 0.16 },
  { p: 1, pos: [-3.4, 4.8, 25], look: [0, 3, 0], fov: 32, ox: 0, oy: 0.16 },
]

/** One flat vector per key: pos(3), look(3), fov, ox, oy. */
const flat = (k: CamKey3) => [...k.pos, ...k.look, k.fov, k.ox, k.oy]
const CHANNELS = 10

/** Fritsch–Butland tangents (per unit p) for every channel of every key. Cached per path. */
const tangentCache = new WeakMap<CamKey3[], number[][]>()
function tangents(path: CamKey3[]) {
  const hit = tangentCache.get(path)
  if (hit) return hit
  const v = path.map(flat)
  const n = path.length
  const m: number[][] = path.map(() => new Array<number>(CHANNELS).fill(0))
  for (let c = 0; c < CHANNELS; c++) {
    const d: number[] = []
    for (let k = 0; k < n - 1; k++) d.push((v[k + 1][c] - v[k][c]) / (path[k + 1].p - path[k].p))
    m[0][c] = d[0]
    m[n - 1][c] = d[n - 2]
    for (let k = 1; k < n - 1; k++) {
      if (d[k - 1] * d[k] <= 0) {
        m[k][c] = 0 // a turning point: settle here
      } else {
        const h0 = path[k].p - path[k - 1].p
        const h1 = path[k + 1].p - path[k].p
        const w1 = 2 * h1 + h0
        const w2 = h1 + 2 * h0
        m[k][c] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k])
      }
    }
  }
  tangentCache.set(path, m)
  return m
}

export function cameraAt(path: CamKey3[], p: number): Omit<CamKey3, 'p'> {
  if (p <= path[0].p) return path[0]
  const last = path[path.length - 1]
  if (p >= last.p) return last
  let i = 0
  while (i < path.length - 2 && p > path[i + 1].p) i++
  const a = path[i]
  const b = path[i + 1]
  const h = b.p - a.p
  const t = (p - a.p) / h
  const t2 = t * t
  const t3 = t2 * t
  // Cubic Hermite basis.
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  const m = tangents(path)
  const va = flat(a)
  const vb = flat(b)
  const o: number[] = []
  for (let c = 0; c < CHANNELS; c++) o.push(h00 * va[c] + h10 * h * m[i][c] + h01 * vb[c] + h11 * h * m[i + 1][c])
  return { pos: [o[0], o[1], o[2]], look: [o[3], o[4], o[5]], fov: o[6], ox: o[7], oy: o[8] }
}
