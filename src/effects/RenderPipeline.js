import * as THREE from 'three';
import { FULLSCREEN_VERT } from '../shaders/common.glsl.js';
import { POST_FRAG } from '../shaders/post.glsl.js';
import { INTERIOR_FRAG, INTERIOR_SAFE_FRAG } from '../shaders/interior.glsl.js';

/**
 * Render graph (3 passes, all at adaptive internal resolution except post):
 *   1. scene  -> sceneRT (color + depth): Earth, jets, dust, debris, grid, probe
 *   2. black hole ray tracer reads sceneRT, writes HDR bhRT
 *      (or the interior shader writes bhRT directly)
 *   3. post: upsample + tonemap + effects -> screen
 */
export class RenderPipeline {
  constructor(renderer) {
    this.renderer = renderer;
    const ext = renderer.extensions;
    const floatOK = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    const type = floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.hdr = floatOK;
    const opts = { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true });
    this.sceneRT.depthTexture = new THREE.DepthTexture(4, 4);
    this.bhRT = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: false });

    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);

    this.postUniforms = {
      uTex: { value: this.bhRT.texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      uExposure: { value: 1 },
      uCA: { value: 0 },
      uStreak: { value: 0 },
      uBlur: { value: 0 },
      uVignette: { value: 0.55 },
      uGrain: { value: 1 },
      uFlash: { value: 0 },
      uFlashCol: { value: new THREE.Color(1, 1, 1) },
      uFade: { value: 0 },
      uLetterbox: { value: 0 },
      uGw: { value: 0 },
      uGwR: { value: 0 },
    };
    this.post = new THREE.ShaderMaterial({
      uniforms: this.postUniforms,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.interiorUniforms = {
      uCamWorld: { value: new THREE.Matrix4() },
      uInvProj: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uStage: { value: 0 },
      uIntensity: { value: 1 },
      uSpin: { value: 0.5 },
      uHotCol: { value: new THREE.Vector3(1, 0.7, 0.4) },
      uCoolCol: { value: new THREE.Vector3(0.4, 0.5, 1) },
    };
    const mk = (frag) => new THREE.ShaderMaterial({ uniforms: this.interiorUniforms, vertexShader: FULLSCREEN_VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
    this.interior = mk(INTERIOR_FRAG);
    this.interiorSafe = mk(INTERIOR_SAFE_FRAG);
    this.useSafeInterior = false;
    this.size = { w: 4, h: 4 };
  }

  setSize(w, h) {
    w = Math.max(2, Math.floor(w));
    h = Math.max(2, Math.floor(h));
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.sceneRT.setSize(w, h);
    this.bhRT.setSize(w, h);
  }

  quadTo(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  dispose() {
    this.sceneRT.dispose();
    this.bhRT.dispose();
    this.post.dispose();
    this.interior.dispose();
    this.interiorSafe.dispose();
    this.quad.geometry.dispose();
  }
}
