// WebGL renderer, lighting rig, shared-screen camera and the tilt-shift "miniature" post effect.
import * as THREE from '../vendor/three.bundle.js';
import { EffectComposer, RenderPass, ShaderPass, OutputPass, RoomEnvironment } from '../vendor/three.bundle.js';
import { setMaxAnisotropy } from './textures.js';

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    dir: { value: new THREE.Vector2(1, 0) },
    focus: { value: 0.5 },
    band: { value: 0.22 },
    amount: { value: 1.0 },
    vignette: { value: 0 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 dir; uniform float focus; uniform float band; uniform float amount; uniform float vignette; uniform float aspect;
    varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - focus);
      float b = smoothstep(band, band + 0.32, d) * amount;
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
      vec2 o1 = dir * 1.3846153846 * b, o2 = dir * 3.2307692308 * b;
      sum += texture2D(tDiffuse, vUv + o1) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv - o1) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv + o2) * 0.0702702703;
      sum += texture2D(tDiffuse, vUv - o2) * 0.0702702703;
      if (vignette > 0.0) {
        vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
        float v = 1.0 - vignette * smoothstep(0.35, 1.05, length(q));
        sum.rgb *= v;
      }
      gl_FragColor = sum;
    }`,
};

export const QUALITY = {
  high: { pr: 2, shadow: 4096, msaa: 4, tilt: true, grass: 1 },
  medium: { pr: 1.35, shadow: 2048, msaa: 4, tilt: true, grass: 0.7 },
  low: { pr: 1, shadow: 1024, msaa: 0, tilt: false, grass: 0.35 },
};

export class GameRenderer {
  constructor(canvas, quality = 'medium') {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    const r = this.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    setMaxAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 12, 2500);
    this.elevation = THREE.MathUtils.degToRad(62); // camera pitch above the table
    this.viewWidth = 92; // table units visible across the screen centre
    this.target = new THREE.Vector3();

    const pm = new THREE.PMREMGenerator(r);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.envTex;

    this.hemi = new THREE.HemisphereLight(0xfff6e8, 0x6b5a48, 0.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.sunDir = new THREE.Vector3(-0.45, 1, -0.35).normalize();
    this.scene.add(this.sun, this.sun.target);
    this.shadowSpan = 150;

    this.quality = null;
    this.setQuality(quality);
    this.resize();
  }

  setQuality(q) {
    if (!QUALITY[q]) q = 'medium';
    this.qualityName = q;
    const Q = (this.quality = QUALITY[q]);
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
    this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    const cam = this.sun.shadow.camera;
    cam.left = -this.shadowSpan / 2; cam.right = this.shadowSpan / 2;
    cam.top = this.shadowSpan / 2; cam.bottom = -this.shadowSpan / 2;
    cam.near = 1; cam.far = 600; cam.updateProjectionMatrix();
    this.buildComposer();
  }

  buildComposer() {
    const r = this.renderer;
    if (this.composer) this.composer.dispose();
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: this.quality.msaa });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.tiltH = new ShaderPass(TiltShiftShader);
    this.tiltV = new ShaderPass(TiltShiftShader);
    this.tiltV.uniforms.vignette.value = 0.32;
    this.tiltH.enabled = this.tiltV.enabled = this.quality.tilt;
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  setLighting(cfg = {}) {
    if (cfg.sunColor != null) this.sun.color.set(cfg.sunColor);
    if (cfg.sunIntensity != null) this.sun.intensity = cfg.sunIntensity;
    if (cfg.sunDir) this.sunDir.set(...cfg.sunDir).normalize();
    if (cfg.hemiSky != null) this.hemi.color.set(cfg.hemiSky);
    if (cfg.hemiGround != null) this.hemi.groundColor.set(cfg.hemiGround);
    if (cfg.hemiIntensity != null) this.hemi.intensity = cfg.hemiIntensity;
    this.scene.environmentIntensity = cfg.envIntensity ?? 0.55;
    this.renderer.toneMappingExposure = cfg.exposure ?? 1.0;
    this.scene.background = new THREE.Color(cfg.background ?? 0x2a2420);
    this.scene.fog = cfg.fog ? new THREE.Fog(cfg.fog.color, cfg.fog.near, cfg.fog.far) : null;
    this.shadowRadius = cfg.shadowRadius ?? 3;
    this.sun.shadow.radius = this.shadowRadius;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      const pr = this.renderer.getPixelRatio();
      const px = 1 / (w * pr), py = 1 / (h * pr);
      // blur radius in pixels at full strength scales with resolution
      const k = Math.max(1, (h * pr) / 900) * 2.2;
      this.tiltH.uniforms.dir.value.set(px * k, 0);
      this.tiltV.uniforms.dir.value.set(0, py * k);
      this.tiltV.uniforms.aspect.value = w / h;
    }
  }

  // Distance needed so `width` table units fill the screen width at the target.
  distanceForWidth(width) {
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    return width / 2 / Math.tan(hfov / 2);
  }

  placeCamera(tx, tz, width = this.viewWidth, ty = 0) {
    this.target.set(tx, ty, tz);
    const d = this.distanceForWidth(width);
    const el = this.elevation;
    this.camera.position.set(tx, ty + d * Math.sin(el), tz + d * Math.cos(el));
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    // keep the shadow frustum centred on what we see, snapped to texels to avoid shimmer
    const span = Math.max(this.shadowSpan, width * 1.6);
    if (Math.abs(span - this.sun.shadow.camera.right * 2) > 1) {
      const c = this.sun.shadow.camera;
      c.left = -span / 2; c.right = span / 2; c.top = span / 2; c.bottom = -span / 2; c.updateProjectionMatrix();
    }
    const texel = span / this.sun.shadow.mapSize.x;
    const cx = Math.round((tx - d * 0.0) / texel) * texel, cz = Math.round((tz - width * 0.08) / texel) * texel;
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx + this.sunDir.x * 260, this.sunDir.y * 260, cz + this.sunDir.z * 260);
    this.sun.target.updateMatrixWorld();
  }

  // Normalised screen position (-1..1) of a world point.
  project(x, y, z, out = new THREE.Vector3()) {
    out.set(x, y, z).project(this.camera);
    return out;
  }

  render() {
    this.composer.render();
  }
}
