// Short explanations for Science Mode. `science` is established physics;
// `lab` explains how this visualization approximates or stylizes it.
export const SCIENCE = {
  horizon: {
    title: 'Event Horizon',
    science: 'The one-way boundary: inside it, every path leads inward, even for light. For a non-spinning hole it sits at the Schwarzschild radius r\u209B = 2GM/c\u00B2.',
    lab: 'The dark shadow is where traced rays are captured. It looks ~2.6\u00D7 wider than the horizon because gravity bends the light around its edge.',
  },
  photon: {
    title: 'Photon Ring',
    science: 'Near 1.5 r\u209B light can circle the hole. Rays grazing this orbit stack into a thin bright ring, the feature the Event Horizon Telescope imaged around M87* (2019) and Sgr A* (2022).',
    lab: 'It emerges from the ray integration itself. Tap the shadow to isolate the higher-order ring images.',
  },
  disk: {
    title: 'Accretion Disk',
    science: 'Gas spirals inward and heats up. Its inner edge sits near the ISCO, which shrinks as spin grows. Gas moving toward you looks brighter and bluer (relativistic beaming).',
    lab: 'Temperature follows the thin-disk law T \u221D r\u207B\u00B3\u2044\u2074. Colors are mapped into visible light; real disks peak in UV or X-rays.',
  },
  lensing: {
    title: 'Gravitational Lensing',
    science: 'Mass curves spacetime, so light follows curved paths. Background stars near the hole shift, stretch and even appear twice.',
    lab: 'Each pixel traces a bent ray through an approximate Schwarzschild deflection field. Physically inspired, not a full GR solver.',
  },
  tidal: {
    title: 'Tidal Forces',
    science: 'Gravity pulls harder on the near side than the far side. Stellar-mass holes spaghettify an Earth far outside the horizon; big supermassive holes can swallow it whole.',
    lab: 'Tidal acceleration and tidal radius are computed for real. The deformation is artistic, and the stellar tidal radius is compressed to fit the scene.',
  },
  jets: {
    title: 'Relativistic Jets',
    science: 'Magnetic fields wound up by a spinning hole can fling plasma out along the spin axis at nearly light speed. Jet power grows roughly with spin\u00B2 (Blandford\u2013Znajek).',
    lab: 'Procedural particle streams. Brightness scales with Jet Power \u00D7 spin\u00B2.',
  },
  time: {
    title: 'Time Dilation',
    science: 'Clocks deeper in a gravity well tick slower than distant ones. A static clock runs at \u221A(1 \u2212 r\u209B/r); an orbiting one at \u221A(1 \u2212 1.5 r\u209B/r).',
    lab: 'Relative Time Visualization. The clocks use these idealized Schwarzschild formulas and ignore spin.',
  },
  probe: {
    title: 'Infalling Probe',
    science: 'A distant observer never sees the probe cross. Its signal slows and redshifts toward zero; for radial light the frequency drops by 1 \u2212 \u221A(r\u209B/r).',
    lab: 'The fall uses the Schwarzschild coordinate speed for a drop from rest at infinity. Pulses are sent every 0.5 s of probe time.',
  },
  gw: {
    title: 'Gravitational Waves',
    science: 'Accelerating masses ripple spacetime itself. LIGO measures strains of ~10\u207B\u00B2\u00B9, a fraction of a proton width over kilometers.',
    lab: 'The ripple is exaggerated by roughly 10\u00B2\u2070 so you can actually see it.',
  },
  singularity: {
    title: 'Singularity',
    science: 'General Relativity predicts infinite density at the center, which really means the theory breaks down there. Nobody knows what actually happens without quantum gravity.',
    lab: 'Everything past the horizon in this lab is hypothetical art.',
  },
};
