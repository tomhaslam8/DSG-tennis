'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Upgrade() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);
    });
  }, []);

  async function handleUpgrade() {
    if (!user) return;
    setLoading(true);
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId: 'join10', userId: user.id, email: user.email }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setLoading(false);
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#f0f9f5', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:380, background:'#fff', borderRadius:24, padding:'2rem', border:'0.5px solid #e0e0e0' }}>

        {/* Trophy */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🎾</div>
          <div style={{ fontSize:11, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Discover Sports · Tennis</div>
          <h1 style={{ fontSize:24, fontWeight:700, margin:'0 0 8px', color:'#0a0a0a' }}>Pack complete!</h1>
          <p style={{ fontSize:14, color:'#666', margin:0, lineHeight:1.7 }}>You've finished your Discover pack.<br/>Ready to make tennis a habit?</p>
        </div>

        {/* Stats recap */}
        <div style={{ background:'#f5f5f5', borderRadius:16, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#0a0a0a', marginBottom:12 }}>Your Discover journey</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[
              { label:'Sessions', value:'3' },
              { label:'Pack used', value:'100%' },
              { label:'Days active', value:'21' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#1D9E75' }}>{s.value}</div>
                <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Join 10 CTA */}
        <div style={{ background:'#E1F5EE', borderRadius:16, padding:16, marginBottom:16, border:'2px solid #1D9E75' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#0F6E56', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Next step</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#085041', marginBottom:4 }}>Join 10</div>
          <div style={{ fontSize:13, color:'#0F6E56', marginBottom:12, lineHeight:1.6 }}>12 sessions, pay for 10. That's 2 free sessions — $80 value included.</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, color:'#0F6E56' }}>✓ 12 credits loaded instantly</div>
              <div style={{ fontSize:11, color:'#0F6E56' }}>✓ 12 weeks to use them</div>
              <div style={{ fontSize:11, color:'#0F6E56' }}>✓ Auto-renews so you never stop</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:26, fontWeight:700, color:'#085041' }}>$400</div>
              <div style={{ fontSize:10, color:'#0F6E56' }}>$33/session</div>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{ width:'100%', padding:14, borderRadius:12, background: loading?'#9FE1CB':'#1D9E75', color:'#fff', border:'none', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}
          >
            {loading ? 'Redirecting to checkout...' : 'Get Join 10 — $400 →'}
          </button>
        </div>

        <button
          onClick={() => window.location.href = '/player'}
          style={{ width:'100%', padding:11, borderRadius:12, background:'transparent', border:'0.5px solid #e0e0e0', fontSize:13, color:'#aaa', cursor:'pointer', fontFamily:'inherit' }}
        >
          Maybe later
        </button>
        <div style={{ fontSize:11, color:'#ccc', textAlign:'center', marginTop:8 }}>You won't be able to book sessions until you top up</div>
      </div>
    </div>
  );
}
