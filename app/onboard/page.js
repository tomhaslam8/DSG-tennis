'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Onboard() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/login';
      else setUser(session.user);
    });
  }, []);

  async function handleSave() {
    if (!name.trim() || !user) return;
    setLoading(true);
    await supabase.from('players').upsert({
      id: user.id,
      email: user.email,
      full_name: name.trim(),
    }, { onConflict: 'id' });
    window.location.href = '/player';
  }

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#f0f9f5'}}>
      <div style={{width:320,background:'#fff',borderRadius:20,padding:'2rem',border:'0.5px solid #e0e0e0'}}>
        <div style={{fontSize:11,color:'#888',marginBottom:4}}>Discover Sports · Tennis</div>
        <h1 style={{fontSize:22,fontWeight:600,margin:'0 0 8px'}}>One last thing</h1>
        <p style={{fontSize:13,color:'#666',margin:'0 0 20px',lineHeight:1.6}}>What should we call you?</p>
        <input type="text" placeholder="Your first name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSave()} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #ddd',fontSize:14,marginBottom:12,fontFamily:'inherit'}} autoFocus/>
        <button onClick={handleSave} disabled={loading||!name.trim()} style={{width:'100%',padding:12,borderRadius:12,background:!name.trim()?'#ccc':'#1D9E75',color:'#fff',border:'none',fontSize:14,fontWeight:600,cursor:!name.trim()?'default':'pointer',fontFamily:'inherit'}}>
          {loading?'Saving...':'Get started'}
        </button>
      </div>
    </div>
  );
}
