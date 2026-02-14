import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Soft Play Near Me - Find Indoor Play Centres Across the UK'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 40%, #ec4899 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: 40, left: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: 60, right: 80, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 100, right: 200, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex' }} />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 80px',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: 'white',
              lineHeight: 1.1,
              marginBottom: 24,
              display: 'flex',
            }}
          >
            Soft Play Near Me
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.4,
              display: 'flex',
            }}
          >
            Find the Best Indoor Play Centres Across the UK
          </div>
        </div>

        {/* URL bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 24,
            padding: '12px 28px',
          }}
        >
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.7)', display: 'flex' }}>
            softplaynearme.co.uk
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
