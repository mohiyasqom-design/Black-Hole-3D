import React from 'react';

const P = {
  sound: 'M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.2-3.9v7.8a4.5 4.5 0 0 0 2.2-3.9z',
  mute: 'M4 9v6h4l5 4V5L8 9H4zm12 0 4 6m0-6-4 6',
  science: 'M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7.5 15h9',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6',
  earth: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  probe: 'M12 3v4M12 17v4M5 12H3M21 12h-2M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 7l2 2M15 15l2 2',
  tour: 'M8 5v14l11-7z',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M16 16v4',
  close: 'M6 6l12 12M18 6 6 18',
  rec: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  stop: 'M7 7h10v10H7z',
  wave: 'M2 12c2 0 2-5 4-5s2 10 4 10 2-10 4-10 2 10 4 10 2-5 4-5',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  down: 'M6 9l6 6 6-6',
};

export function Icon({ name, size = 18, fill = false }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={P[name]} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
