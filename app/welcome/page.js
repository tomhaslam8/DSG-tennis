'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function WelcomeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (email) sendMagicLink();
  }, [email]);

  async function sendMagicLink() {
    setSending(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/player' },
    });
    setSending(false);
    setSent(true);
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#f0f9f5', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:380, background:'#fff', borderRadius:24, padding:'2rem', border:'0.5px solid #e0e0e0', textAlign:'center' }}>

        <div style={{ width:64, height:64, borderRadius:'50%', background:'#E1F5EE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>

        <div style={{ fontSize:11, color:'#aaa', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Discover Sports · Tennis</div>
        <h1 style={{ fontSize:24, fontWeight:700, margin:'0 0 10px', color:'#0a0a0a' }}>You're in! 🎾</h1>
        <p style={{ fontSize:14, color:'#666', margin:'0 0 24px', lineHeight:1.7 }}>
          Your Discover pack is ready. We've sent a login link to<br/>
          <strong style={{ color:'#0a0a0a' }}>{email}</strong>
        </p>

        <div style={{ background:'#f5f5f5', borderRadius:16, padding:'16px', marginBottom:20, textAlign:'left' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#0a0a0a', marginBottom:12 }}>What's next:</div>
          {[
            { n:'1', text:'Check your email for the login link' },
            { n:'2', text:'Tap the link to access your credits' },
            { n:'3', text:'Book your first session' },
          ].map(step => (
            <div key={step.n} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:10 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'#1D9E75', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>{step.n}</div>
              <div style={{ fontSize:13, color:'#444', lineHeight:1.5 }}>{step.text}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#E1F5EE', borderRadius:12, padding:'12px 14px', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#085041', marginBottom:2 }}>Your Discover Pack</div>
          <div style={{ fontSize:12, color:'#0F6E56' }}>3 lesson credits + 1 social ticket · 21 days to use</div>
        </div>

        {!sent && sending && (
          <div style={{ fontSize:12, color:'#aaa' }}>Sending your login link...</div>
        )}
        {sent && (
          <div style={{ fontSize:12, color:'#0F6E56', fontWeight:500 }}>✓ Login link sent to {email}</div>
        )}

        <button
          onClick={sendMagicLink}
          disabled={sending}
          style={{ width:'100%', padding:12, borderRadius:12, background:'transparent', border:'0.5px solid #e0e0e0', fontSize:13, color:'#888', cursor:'pointer', fontFamily:'inherit', marginTop:12 }}
        >
          Resend login link
        </button>
      </div>
    </div>
  );
}

export default function Welcome() {
  return (
    <Suspense>
      <WelcomeContent />
    </Suspense>
  );
}
