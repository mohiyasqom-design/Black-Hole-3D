// Rendering tiers. `scale` is the internal render resolution relative to the
// canvas; AUTO moves it between minScale and scale to hold the frame rate.
export const QUALITY = {
  low:    { id: 'low',    label: 'Low',    pr: 1.0, scale: 0.55, minScale: 0.38, steps: 72,  stepK: 0.14, starQ: 0, jets: 1600, dust: 1400, debris: 1800, earthSeg: [48, 32] },
  medium: { id: 'medium', label: 'Medium', pr: 1.5, scale: 0.72, minScale: 0.45, steps: 112, stepK: 0.1,  starQ: 1, jets: 3600, dust: 2800, debris: 3200, earthSeg: [80, 56] },
  high:   { id: 'high',   label: 'High',   pr: 2.0, scale: 0.92, minScale: 0.55, steps: 160, stepK: 0.07, starQ: 1, jets: 7000, dust: 5200, debris: 5000, earthSeg: [128, 96] },
};
export const MAX_PARTICLES = { jets: 7000, dust: 5200, debris: 5000 };
