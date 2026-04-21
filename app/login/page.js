'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/player' },
    });
    setLoading(false);
    if (!error) setSent(true);
  }

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#f0f9f5'}}>
      <div style={{width:320,background:'#fff',borderRadius:20,padding:'2rem',border:'0.5px solid #e0e0e0'}}>
        <div style={{fontSize:11,color:'#888',marginBottom:4}}>Discover Sports · Tennis</div>
        <h1 style={{fontSize:22,fontWeight:600,margin:'0 0 8px'}}>Welcome</h1>
        {!sent ? (
          <>
            <p style={{fontSize:13,color:'#666',margin:'0 0 20px',lineHeight:1.6}}>Enter your email and we'll send you a login link.</p>
            <input type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #ddd',fontSize:14,marginBottom:12,fontFamily:'inherit'}}/>
            <button onClick={handleLogin} disabled={loading} style={{width:'100%',padding:12,borderRadius:12,background:loading?'#9FE1CB':'#1D9E75',color:'#fff',border:'none',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{loading?'Sending...':'Send login link'}</button>
          </>
        ) : (
          <div style={{textAlign:'center',padding:'1rem 0'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:'#E1F5EE',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{fontSize:15,fontWeight:600,margin:'0 0 6px'}}>Check your email</p>
            <p style={{fontSize:12,color:'#888',margin:0}}>We sent a link to <strong>{email}</strong></p>
            <button onClick={()=>setSent(false)} style={{marginTop:16,fontSize:12,color:'#1D9E75',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>Use a different email</button>
          </div>
        )}
      </div>
    </div>
  );
}
