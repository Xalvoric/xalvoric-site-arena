// GLSL for the monolith scene. Plain strings so the bundle needs no loader.

/** Backdrop: near-black dome with a soft horizon glow behind the monolith. */
export const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

export const skyFrag = /* glsl */ `
uniform vec3 uGlowDir;
uniform float uGlow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float horizon = exp(-abs(d.y - 0.02) * 16.0);
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), uGlowDir), 0.0);
  float glow = pow(toward, 30.0) * exp(-abs(d.y - 0.02) * 11.0);
  vec3 col = vec3(0.003) + vec3(0.018) * horizon + vec3(0.9) * glow * uGlow;
  gl_FragColor = vec4(col, 1.0);
}`

/** Edge lines that draw on from the apex down. */
export const lineVert = /* glsl */ `
attribute float aDraw;
varying float vDraw;
void main() {
  vDraw = aDraw;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

export const lineFrag = /* glsl */ `
uniform float uBuild;
uniform float uAlpha;
uniform float uBoost;
varying float vDraw;
void main() {
  if (vDraw > uBuild) discard;
  gl_FragColor = vec4(vec3(uBoost), uAlpha);
}`

/** Dust drifting in the fog; gathers round the monolith in beat 2, scatters in beat 3. */
export const dustVert = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform float uConverge;
uniform float uScatter;
uniform float uSize;
varying float vAlpha;
void main() {
  float r = aSeed.x * mix(1.0, 0.32, uConverge) * (1.0 + uScatter * 0.9);
  float a = aSeed.y + uTime * 0.025 * (0.4 + aSeed.z) + uConverge * 1.4 * (1.2 - aSeed.x / 12.0);
  float y = mod(aSeed.z * 9.5 + uTime * 0.06 * (0.3 + fract(aSeed.y * 3.0)), 9.5);
  vec3 p = vec3(cos(a) * r, y, sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dz = -mv.z;
  gl_PointSize = min(uSize * (10.0 / dz), uSize * 3.0);
  // Fade dust that drifts too close to the lens, so it never turns into big blobs.
  vAlpha = smoothstep(45.0, 3.0, dz) * smoothstep(1.2, 3.5, dz) * (0.2 + 0.5 * fract(aSeed.y * 7.13));
  gl_Position = projectionMatrix * mv;
}`

export const dustFrag = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vec3(1.0), vAlpha * smoothstep(0.5, 0.0, d));
}`

/** Fullscreen pass: glitch slices + ghosts, ACES, monochrome, fog veil, vignette, grain. */
export const postVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

export const postFrag = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uTime;
uniform float uGlitch;
uniform float uSeed;
uniform float uExposure;
uniform float uGrain;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  float bands = mix(16.0, 40.0, hash(vec2(uSeed, 1.7)));
  float band = floor(uv.y * bands);
  float on = step(1.0 - uGlitch * 0.5, hash(vec2(band, uSeed)));
  uv.x += on * (hash(vec2(band, uSeed + 3.1)) - 0.5) * 0.06 * uGlitch;

  // Chromatic split: only inside a transition, so the rest of the page stays pure monochrome.
  float ab = 0.007 * uGlitch;
  vec3 c = vec3(texture2D(tScene, uv + vec2(ab, 0.0)).r, texture2D(tScene, uv).g, texture2D(tScene, uv - vec2(ab, 0.0)).b);
  float g = 0.008 * uGlitch;
  vec3 ghosts = texture2D(tScene, uv + vec2(g, 0.0)).rgb + texture2D(tScene, uv - vec2(g, 0.0)).rgb;
  c += ghosts * 0.22 * uGlitch;

  c = aces(c * uExposure);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Cold grey grade at rest; the colour fringes fade in with the glitch.
  vec3 grey = vec3(l) * vec3(0.97, 0.99, 1.02);
  c = mix(grey, c * vec3(0.97, 0.99, 1.02), clamp(uGlitch * 1.3, 0.0, 1.0));

  float veil = uGlitch * 0.42 * (0.6 + 0.4 * (1.0 - abs(vUv.y - 0.55) * 2.0));
  c = mix(c, vec3(0.74, 0.75, 0.76), veil);

  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= mix(0.6, 1.0, smoothstep(1.2, 0.35, length(q)));

  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * uGrain;
  gl_FragColor = vec4(c, 1.0);
}`
