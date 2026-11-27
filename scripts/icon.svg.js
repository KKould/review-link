// Builds the icon SVG. `pad` is transparent padding in a 128-unit canvas
// (Chrome Web Store wants 16 for the 128px icon; small toolbar icons use 0).
export function iconSvg({ size, pad }) {
  const tile = 128 - pad * 2;
  const s = tile / 96; // artwork is drawn on a 96-unit tile
  const x = (v) => (pad + v * s).toFixed(2);
  const d = (v) => (v * s).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="bg" cx="50%" cy="22%" r="85%">
      <stop offset="0" stop-color="#3a3a3a"/>
      <stop offset="0.6" stop-color="#151515"/>
      <stop offset="1" stop-color="#0a0a0a"/>
    </radialGradient>
  </defs>
  <rect x="${x(0.75)}" y="${x(0.75)}" width="${d(94.5)}" height="${d(94.5)}" rx="${d(22)}" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.22" stroke-width="${d(1.5)}"/>
  <rect x="${x(18)}" y="${x(24)}" width="${d(38)}" height="${d(11)}" rx="${d(5.5)}" fill="#ffffff"/>
  <rect x="${x(18)}" y="${x(43)}" width="${d(28)}" height="${d(11)}" rx="${d(5.5)}" fill="#ffffff" fill-opacity="0.72"/>
  <rect x="${x(18)}" y="${x(62)}" width="${d(18)}" height="${d(11)}" rx="${d(5.5)}" fill="#ffffff" fill-opacity="0.45"/>
  <rect x="${x(60)}" y="${x(28.25)}" width="${d(9)}" height="${d(2.5)}" rx="${d(1.25)}" fill="#ffffff" fill-opacity="0.85"/>
  <circle cx="${x(76)}" cy="${x(29.5)}" r="${d(7.5)}" fill="#ffffff"/>
  <circle cx="${x(76)}" cy="${x(29.5)}" r="${d(3)}" fill="#151515"/>
</svg>`;
}
