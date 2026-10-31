import { ImageResponse } from 'next/og';

export const alt = 'bri — markdown notes, links, and cli';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 76, background: '#050505', color: '#f5f5f5', fontFamily: 'monospace' }}>
      <div style={{ fontSize: 26, letterSpacing: 2 }}>bri</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ fontSize: 58, lineHeight: 1.2, maxWidth: 860 }}>write it once. keep it useful.</div>
        <div style={{ fontSize: 25, lineHeight: 1.5, color: '#a3a3a3', maxWidth: 850 }}>private markdown notes and useful links, ready to share when you are.</div>
      </div>
      <div style={{ fontSize: 18, color: '#737373' }}>bri.fyi</div>
    </div>,
    size,
  );
}
