// Real-time WebGL hero: a procedural black-glass monolith in fog, lit from
// behind, with drifting dust, circuit traces that light up in beat 2, edge
// lines for the build-in, and one fullscreen post pass (glitch transitions,
// ACES, monochrome grade, vignette, grain). Loaded lazily by ScrollScene.
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  HalfFloatType,
  LineSegments,
  LinearSRGBColorSpace,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from 'three'
import { beats } from '../config'
import { transitionAt } from '../effects'
import { clamp, opacityAt } from '../timeline'
import type { AnchorName, FrameState, HeroRenderer } from '../renderer'
import { cameraAt, desktopPath, portraitPath } from './cameraPath'
import { circuitTexture, edgeGeometry, halfAt, M, monolithGeometry } from './geometry'
import * as S from './shaders'

const ramp = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1)

/** World-space points the SVG overlay pins labels and callouts to. */
const ANCHORS: Record<AnchorName, Vector3> = {
  mark0: new Vector3(0, M.apex, 0),
  mark1: new Vector3(-halfAt(3.0), 3.0, halfAt(3.0)),
  callout0: new Vector3(halfAt(4.6), 4.6, halfAt(4.6)),
  callout1: new Vector3(halfAt(3.8), 3.8, halfAt(3.8)),
  callout2: new Vector3(halfAt(3.0), 3.0, halfAt(3.0)),
}

export type MonolithOptions = { tilt: boolean; mobile: boolean }

export class MonolithRenderer implements HeroRenderer {
  readonly kind = 'webgl'
  private gl: WebGLRenderer
  private scene = new Scene()
  private camera = new PerspectiveCamera(30, 1, 0.1, 220)
  private rt: WebGLRenderTarget
  private postScene = new Scene()
  private postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private postMat: ShaderMaterial
  private lineMat: ShaderMaterial
  private dustMat: ShaderMaterial
  private body: MeshPhysicalMaterial
  private mirror: MeshPhysicalMaterial
  private env: Texture
  private fog: FogExp2
  private cssW = 1
  private cssH = 1
  private opts: MonolithOptions
  private tmp = new Vector3()
  private disposables: { dispose(): void }[] = []

  constructor(canvas: HTMLCanvasElement, opts: MonolithOptions) {
    this.opts = opts
    // Throws if WebGL can't be created; ScrollScene then keeps the stills.
    this.gl = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.gl.setClearColor(0x050505, 1)
    this.gl.toneMapping = NoToneMapping
    // The post pass tone-maps and encodes to sRGB itself.
    this.gl.outputColorSpace = LinearSRGBColorSpace

    this.rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: opts.mobile ? 0 : 4 })

    // --- backdrop + environment ------------------------------------------
    const skyMat = new ShaderMaterial({
      vertexShader: S.skyVert,
      fragmentShader: S.skyFrag,
      side: BackSide,
      depthWrite: false,
      uniforms: { uGlowDir: { value: new Vector3(0, 0, -1) }, uGlow: { value: 0.55 } },
    })
    const sky = new Mesh(new SphereGeometry(100, 48, 24), skyMat)
    this.scene.add(sky)
    const envScene = new Scene()
    // A brighter, broader copy of the sky for reflections: gives the facets their rim light.
    const envSky = new Mesh(
      sky.geometry,
      new ShaderMaterial({
        vertexShader: S.skyVert,
        fragmentShader: S.skyFrag,
        side: BackSide,
        uniforms: { uGlowDir: { value: new Vector3(0, 0, -1) }, uGlow: { value: 2.0 } },
      }),
    )
    envScene.add(envSky)
    const pmrem = new PMREMGenerator(this.gl)
    const envRT = pmrem.fromScene(envScene, 0.04)
    this.env = envRT.texture
    this.scene.environment = this.env
    // Fog matches the sky's horizon tone so the floor melts into it.
    this.fog = new FogExp2(new Color().setRGB(0.021, 0.021, 0.022, LinearSRGBColorSpace), 0.045)
    this.scene.fog = this.fog
    this.disposables.push(pmrem, envRT, envSky.material as ShaderMaterial, skyMat, sky.geometry)

    // --- monolith ----------------------------------------------------------
    const circuits = circuitTexture(opts.mobile ? 512 : 1024)
    this.body = new MeshPhysicalMaterial({
      color: new Color(0x111111),
      roughness: 0.2,
      metalness: 0.45,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      flatShading: true,
      emissive: new Color(0xffffff),
      emissiveMap: circuits,
      emissiveIntensity: 0,
      // Lets the edge lines sit on top of the faces without z-fighting.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    const geo = monolithGeometry()
    const monolith = new Mesh(geo, this.body)
    this.scene.add(monolith)

    // Wet-floor reflection: a mirrored copy seen through a slightly translucent ground.
    this.mirror = this.body.clone()
    this.mirror.side = DoubleSide
    this.mirror.color = new Color(0x050505)
    const reflection = new Mesh(geo, this.mirror)
    reflection.scale.y = -1
    this.scene.add(reflection)

    const metal = new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.22, metalness: 1 })
    const plateGeo = new CylinderGeometry(M.plateRadius, M.plateRadius, 0.04, 96)
    const plate = new Mesh(plateGeo, metal)
    plate.position.y = 0.02
    this.scene.add(plate)

    const groundMat = new MeshStandardMaterial({
      color: 0x080808,
      roughness: 0.42,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9,
    })
    const groundGeo = new PlaneGeometry(240, 240)
    groundGeo.rotateX(-Math.PI / 2)
    this.scene.add(new Mesh(groundGeo, groundMat))

    // Back rim, a raking key from the upper right (facet highlights) and a faint fill.
    const rim = new DirectionalLight(0xffffff, 3.2)
    rim.position.set(-4, 9, -10)
    const key = new DirectionalLight(0xffffff, 1.6)
    key.position.set(10, 9, -1)
    const fill = new DirectionalLight(0xffffff, 0.12)
    fill.position.set(-6, 3, 9)
    this.scene.add(rim, key, fill)

    // --- edge lines (build-in) --------------------------------------------
    this.lineMat = new ShaderMaterial({
      vertexShader: S.lineVert,
      fragmentShader: S.lineFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { uBuild: { value: 0 }, uAlpha: { value: 1 }, uBoost: { value: 1 } },
    })
    const edges = new LineSegments(edgeGeometry(), this.lineMat)
    this.scene.add(edges)

    // --- dust ----------------------------------------------------------------
    const count = opts.mobile ? 900 : 1700
    const seeds = new Float32Array(count * 3)
    let s = 4241
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = 1.4 + Math.pow(rand(), 0.7) * 11
      seeds[i * 3 + 1] = rand() * Math.PI * 2
      seeds[i * 3 + 2] = rand()
    }
    const dustGeo = new BufferGeometry()
    dustGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3))
    dustGeo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 3))
    this.dustMat = new ShaderMaterial({
      vertexShader: S.dustVert,
      fragmentShader: S.dustFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uConverge: { value: 0 },
        uScatter: { value: 0 },
        uSize: { value: 1 },
      },
    })
    const dust = new Points(dustGeo, this.dustMat)
    dust.frustumCulled = false
    this.scene.add(dust)

    // --- post ------------------------------------------------------------------
    this.postMat = new ShaderMaterial({
      vertexShader: S.postVert,
      fragmentShader: S.postFrag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.rt.texture },
        uRes: { value: new Vector2(1, 1) },
        uTime: { value: 0 },
        uGlitch: { value: 0 },
        uSeed: { value: 0 },
        uExposure: { value: 1 },
        uGrain: { value: 0.045 },
      },
    })
    const quad = new Mesh(new PlaneGeometry(2, 2), this.postMat)
    this.postScene.add(quad)

    this.disposables.push(
      circuits,
      this.body,
      this.mirror,
      geo,
      metal,
      plateGeo,
      groundMat,
      groundGeo,
      this.lineMat,
      edges.geometry,
      this.dustMat,
      dustGeo,
      this.postMat,
      quad.geometry,
      this.rt,
    )

    // Compile every program now, so the first visible frame doesn't hitch.
    this.gl.compile(this.scene, this.camera)
    this.gl.compile(this.postScene, this.postCam)
  }

  resize(cssW: number, cssH: number) {
    this.cssW = Math.max(1, cssW)
    this.cssH = Math.max(1, cssH)
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.mobile ? 1.5 : 2)
    this.gl.setPixelRatio(dpr)
    this.gl.setSize(this.cssW, this.cssH, false)
    const w = Math.round(this.cssW * dpr)
    const h = Math.round(this.cssH * dpr)
    this.rt.setSize(w, h)
    ;(this.postMat.uniforms.uRes.value as Vector2).set(w, h)
    this.dustMat.uniforms.uSize.value = (this.opts.mobile ? 2.2 : 2.6) * dpr
  }

  /** Position the camera for this frame (idempotent, so anchors can reuse it). */
  private place(s: FrameState) {
    const portrait = this.cssW < this.cssH
    const c = cameraAt(portrait ? portraitPath : desktopPath, s.p)
    const cam = this.camera
    cam.position.set(c.pos[0], c.pos[1], c.pos[2])
    cam.lookAt(c.look[0], c.look[1], c.look[2])
    if (this.opts.tilt) {
      // Small parallax toward the pointer.
      cam.translateX(s.tiltX * 0.35)
      cam.translateY(-s.tiltY * 0.22)
      cam.lookAt(c.look[0], c.look[1], c.look[2])
    }
    cam.fov = c.fov
    cam.aspect = this.cssW / this.cssH
    cam.setViewOffset(this.cssW, this.cssH, c.ox * this.cssW, c.oy * this.cssH, this.cssW, this.cssH)
    cam.updateProjectionMatrix()
  }

  frame(s: FrameState) {
    this.place(s)
    const t = s.now / 1000
    const fx = transitionAt(s.p)
    const exposure = 0.16 + 0.84 * ramp(s.build, 0.35, 1)

    // Beat 2: circuits light up and the dust gathers round the monolith.
    const detail = opacityAt([0.3, 0.46, 0.62, 0.76], s.p)
    this.body.emissiveIntensity = 0.04 + 0.9 * detail
    this.mirror.emissiveIntensity = this.body.emissiveIntensity * 0.4
    this.dustMat.uniforms.uTime.value = t
    this.dustMat.uniforms.uConverge.value = detail
    this.dustMat.uniforms.uScatter.value = ramp(s.p, beats[2].window[0], 1)

    // Edges also come back faintly in beat 2, so the callouts have a visible edge to pin to.
    this.lineMat.uniforms.uBuild.value = Math.max(s.build, detail)
    this.lineMat.uniforms.uAlpha.value = Math.max(s.lineAlpha * 0.85, detail * 0.35)
    // Lines read white even while the scene exposure is still rising.
    this.lineMat.uniforms.uBoost.value = Math.min(12, 1.6 / exposure)

    // The fog thickens through each transition, so the dive is real depth and not only a grey veil.
    this.fog.density = 0.045 + fx.amount * 0.07

    const pu = this.postMat.uniforms
    pu.uTime.value = t
    pu.uGlitch.value = fx.amount
    pu.uSeed.value = fx.index * 10 + Math.floor(fx.amount * 7)
    pu.uExposure.value = exposure

    this.gl.setRenderTarget(this.rt)
    this.gl.render(this.scene, this.camera)
    this.gl.setRenderTarget(null)
    this.gl.render(this.postScene, this.postCam)
    // Dust and grain are ambient, so keep drawing while the hero is on screen.
    return true
  }

  anchor(name: AnchorName, s: FrameState): [number, number] | null {
    this.place(s)
    const v = this.tmp.copy(ANCHORS[name]).project(this.camera)
    if (v.z > 1) return null
    return [((v.x + 1) / 2) * this.cssW, ((1 - v.y) / 2) * this.cssH]
  }

  outline() {
    // The edge lines are drawn in WebGL.
    return null
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose())
    const lost = this.gl.getContext().isContextLost()
    this.gl.dispose()
    // Free the GPU context now rather than waiting for GC (unless it's already gone).
    if (!lost) this.gl.forceContextLoss()
  }
}
