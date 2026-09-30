// Dual-asset architecture. The manifest lists optional GLB files produced by
// the Blender pipeline. Anything disabled, missing or broken falls back to the
// procedural implementation, so the app never depends on these files.
export class AssetRegistry {
  constructor(base = import.meta.env.BASE_URL || './') {
    this.base = base.endsWith('/') ? base : base + '/';
    this.models = new Map();
    this.status = {};
  }

  async init(timeoutMs = 2500) {
    let manifest = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${this.base}assets/manifest.json`, { signal: ctrl.signal, cache: 'no-cache' });
      clearTimeout(timer);
      if (res.ok) manifest = await res.json();
    } catch (e) {
      manifest = null;
    }
    const entries = Object.entries(manifest?.assets ?? {}).filter(([, v]) => v && v.enabled);
    for (const key of Object.keys(manifest?.assets ?? {})) this.status[key] = 'procedural';
    if (!entries.length) return this;

    let GLTFLoader;
    try {
      ({ GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'));
    } catch (e) {
      console.warn('[BHL] GLTFLoader unavailable, staying procedural');
      return this;
    }
    const loader = new GLTFLoader();
    await Promise.all(
      entries.map(async ([key, entry]) => {
        try {
          const gltf = await loader.loadAsync(`${this.base}assets/${entry.url}`);
          this.models.set(key, gltf.scene);
          this.status[key] = 'glb';
        } catch (e) {
          this.status[key] = 'missing';
          console.warn(`[BHL] optional asset "${key}" not loaded, using procedural fallback`);
        }
      })
    );
    return this;
  }

  get(key) {
    return this.models.get(key) ?? null;
  }

  summary() {
    const glb = Object.values(this.status).filter((s) => s === 'glb').length;
    return glb ? `${glb} GLB + procedural` : 'Procedural';
  }
}
