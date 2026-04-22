'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PACKS = [
  {
    id: 'discover',
    name: 'Discover Pack',
    price: 120,
    credits: 3,
    description: '3 lessons + social evening + all equipment',
    expiry: '21 days to use',
    highlight: false,
  },
  {
    id: 'join10',
    name: 'Join 10',
    price: 400,
    credits: 12,
    description: '12 sessions, pay for 10. That's 2 free sessions on us.',
    expiry: '12 weeks · Auto-renews so you never stop playing',
    highlight: true,
  },
];

export default function Purchase() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/login';
      else setUser(session.user);
    });
    if (typeof window !== 'undefined' && window.location.search.includes('expired=true')) setExpired(true);
  }, []);

  async function handleBuy(pack) {
    if (!user) return;
    setLoading(pack.id);
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId: pack.id, userId: user.id, email: user.email }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setLoading(null);
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f0f9f5', padding:'2rem 1rem' }}>
      <div style={{ maxWidth:400, margin:'0 auto' }}>
        <div style={{ fontSize:11, color:'#888', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Discover Sports · Tennis</div>
        {expired && (
          <div style={{ background:'#FAEEDA', borderRadius:12, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#633806' }}>
            <div style={{ fontWeight:600, marginBottom:2 }}>Your pack has expired</div>
            <div style={{ fontSize:12 }}>Get Join 10 to keep playing — 12 sessions, pay for 10.</div>
          </div>
        )}
        <h1 style={{ fontSize:24, fontWeight:600, margin:'0 0 6px' }}>{expired ? 'Top up to keep playing' : 'Get started'}</h1>
        <p style={{ fontSize:13, color:'#666', margin:'0 0 24px' }}>{expired ? 'Your credits have run out. Choose a pack below.' : 'Choose a pack to begin playing.'}</p>

        {PACKS.filter(pack => !expired || pack.id === 'join10').map(pack => (
          <div key={pack.id} style={{ background:'#fff', borderRadius:16, padding:'1.25rem', marginBottom:12, border: pack.highlight ? '2px solid #1D9E75' : '0.5px solid #e0e0e0' }}>
            {pack.highlight && <div style={{ fontSize:10, fontWeight:600, color:'#0F6E56', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Most popular</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#0a0a0a' }}>{pack.name}</div>
                <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{pack.description}</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{pack.expiry}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0, marginLeft:12 }}>
                <div style={{ fontSize:22, fontWeight:600, color:'#0a0a0a' }}>${pack.price}</div>
                <div style={{ fontSize:11, color:'#888' }}>{pack.credits} credits</div>
              </div>
            </div>
            <button
              onClick={() => handleBuy(pack)}
              disabled={loading === pack.id}
              style={{ width:'100%', padding:'11px', borderRadius:12, background: loading===pack.id ? '#9FE1CB' : '#1D9E75', color:'#fff', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginTop:8 }}
            >
              {loading === pack.id ? 'Redirecting...' : `Buy ${pack.name} — $${pack.price}`}
            </button>
          </div>
        ))}

        <p style={{ fontSize:11, color:'#aaa', textAlign:'center', marginTop:16 }}>Secure payment via Stripe. Credits load instantly on payment.</p>
      </div>
    </div>
  );
}
