'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const WEEKLY_TEMPLATE = [
  { id:1,  day:0, name:"Beginner",                   level:"Beginner",   time:"7:00pm", end:"8:00pm",  type:"lesson", credits:1,   cap:6  },
  { id:2,  day:0, name:"Int / Adv",                  level:"Int / Adv",  time:"7:00pm", end:"8:30pm",  type:"lesson", credits:1.5, cap:5  },
  { id:3,  day:1, name:"Beginner / Int",             level:"Beg / Int",  time:"10:00am",end:"11:30am", type:"lesson", credits:1.5, cap:10 },
  { id:4,  day:1, name:"Beginner",                   level:"Beginner",   time:"7:00pm", end:"8:00pm",  type:"lesson", credits:1,   cap:6  },
  { id:5,  day:1, name:"Int / Adv",                  level:"Int / Adv",  time:"7:00pm", end:"8:00pm",  type:"lesson", credits:1,   cap:5  },
  { id:6,  day:1, name:"Int / Adv Social Matchplay", level:"Int / Adv",  time:"8:00pm", end:"9:00pm",  type:"social", credits:1,   cap:6  },
  { id:7,  day:2, name:"Beginner",                   level:"Beginner",   time:"7:00pm", end:"8:00pm",  type:"lesson", credits:1,   cap:10 },
  { id:8,  day:2, name:"Int / Adv",                  level:"Int / Adv",  time:"7:00pm", end:"8:30pm",  type:"lesson", credits:1.5, cap:5  },
  { id:9,  day:3, name:"Beginner / Int",             level:"Beg / Int",  time:"10:00am",end:"11:30am", type:"lesson", credits:1.5, cap:10 },
  { id:10, day:3, name:"Beginner",                   level:"Beginner",   time:"7:00pm", end:"8:00pm",  type:"lesson", credits:1,   cap:6  },
  { id:11, day:4, name:"Social Matchplay",           level:"All levels", time:"7:30pm", end:"8:30pm",  type:"social", credits:1,   cap:12 },
  { id:12, day:5, name:"Beg / Int / Adv",            level:"All levels", time:"9:00am", end:"10:00am", type:"lesson", credits:1,   cap:16 },
  { id:13, day:5, name:"Club Social",                level:"All levels", time:"10:00am",end:"11:00am", type:"social", credits:1,   cap:16 },
];

const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MONTHS    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function generateSessions() {
  const today = new Date();
  const sessions = [];
  let uid = 1;
  for (let week = 0; week < 2; week++) {
    WEEKLY_TEMPLATE.forEach(t => {
      const d = new Date(today);
      const currentDay = today.getDay() === 0 ? 7 : today.getDay();
      const targetDay = t.day + 1;
      let daysAhead = targetDay - currentDay + (week * 7);
      if (daysAhead < 0) daysAhead += 7;
      d.setDate(today.getDate() + daysAhead);
      const dateStr = DAY_NAMES[t.day].slice(0,3) + " " + d.getDate() + " " + MONTHS[d.getMonth()];
      const seed = t.id * 7 + week * 13;
      const booked = Math.floor((Math.sin(seed) * 0.5 + 0.5) * (t.cap * 0.7));
      sessions.push({
        id: uid++, name: t.name, level: t.level,
        date: dateStr, day: DAY_NAMES[t.day],
        time: t.time, end: t.end,
        type: t.type, credits: t.credits,
        spots: t.cap - booked, cap: t.cap,
      });
    });
  }
  return sessions;
}

const SESSIONS = generateSessions();

export default function PlayerApp({ user }) {
  const [pview, setPview]       = useState('home');
  const [selected, setSelected] = useState(null);
  const [packData, setPackData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [bookings, setBookings] = useState([]);

  const firstName = user?.email?.split('@')[0] || 'there';

  useEffect(() => {
    loadPackData();
  }, [user]);

  async function loadPackData() {
    if (!user) return;
    const { data } = await supabase
      .from('player_packs')
      .select('*, packs(name), social_credits')
      .eq('player_id', user.id)
      .eq('status', 'active')
      .order('purchased_at', { ascending: false })
      .limit(1)
      .single();
    setPackData(data);
    setLoading(false);
  }

  const credits = packData ? packData.credits_total - packData.credits_used : 0;
  const socialCredits = packData?.social_credits || 0;
  const packTotal = packData?.credits_total || 12;
  const packName = packData?.packs?.name || 'No active pack';
  const used = packTotal - credits;

  function doBook(s) { setSelected(s); setPview('confirm'); }

  async function doConfirm() {
    const newUsed = packData.credits_used + selected.credits;
    await supabase.from('player_packs').update({ credits_used: newUsed }).eq('id', packData.id);
    setBookings(b => [{ id: Date.now(), name: selected.name, date: selected.date, time: selected.time, status: 'upcoming' }, ...b]);
    setPackData(p => ({ ...p, credits_used: newUsed }));
    setPview('success');
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' }}>
      <div style={{ fontSize:13, color:'#888' }}>Loading your account...</div>
    </div>
  );

  return (
    <div style={{ display:'flex', justifyContent:'center', background:'var(--color-background-secondary, #f5f5f5)', minHeight:'100vh', padding:'1rem 0' }}>
      <div style={{ width:340, background:'#fff', borderRadius:32, border:'0.5px solid #e0e0e0', overflow:'hidden', display:'flex', flexDirection:'column', minHeight:680 }}>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 20px 8px', fontSize:11 }}>
          <span style={{ fontWeight:600 }}>{new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
          <span style={{ color:'#aaa', letterSpacing:'0.03em' }}>Discover Sports · Tennis</span>
        </div>

        <div style={{ flex:1, padding:'0 16px', overflowY:'auto' }}>

          {pview === 'home' && (
            <div style={{ paddingBottom:16 }}>
              <div style={{ padding:'12px 0 14px' }}>
                <div style={{ fontSize:11, color:'#aaa' }}>Good morning</div>
                <div style={{ fontSize:22, fontWeight:600, lineHeight:1.2, marginTop:2, color:'#0a0a0a' }}>{firstName}</div>
              </div>

              {!packData ? (
                <div style={{ background:'#f5f5f5', borderRadius:16, padding:16, marginBottom:10, textAlign:'center' }}>
                  <div style={{ fontSize:13, color:'#666', marginBottom:12 }}>You don't have an active pack yet.</div>
                  <button onClick={() => window.location.href='/purchase'} style={{ padding:'10px 20px', borderRadius:12, background:'#1D9E75', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer' }}>Get started</button>
                </div>
              ) : (
                <div style={{ background:'#E1F5EE', borderRadius:16, padding:14, marginBottom:10 }}>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#085041' }}>{packName}</div>
                    <div style={{ fontSize:11, color:'#0F6E56', marginTop:2 }}>{credits} credit{credits!==1?'s':''} remaining</div>
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
                    {Array.from({length: Math.min(packTotal, 12)}).map((_,i) => (
                      <div key={i} style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600, background: i<used ? '#9FE1CB' : '#fff', color: i<used ? '#085041' : '#0F6E56', border: i<used ? 'none' : '1.5px solid #5DCAA5' }}>
                        {i < used ? '✓' : i+1}
                      </div>
                    ))}
                  </div>
                  <div style={{ height:4, background:'#9FE1CB', borderRadius:2, marginBottom:4 }}>
                    <div style={{ height:4, background:'#0F6E56', borderRadius:2, width:`${Math.min((used/packTotal)*100,100)}%` }} />
                  </div>
                  <div style={{ fontSize:10, color:'#0F6E56' }}>{used} of {packTotal} used</div>
                  {socialCredits > 0 && <div style={{ width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:600, background:'#EEEDFE', color:'#3C3489', border:'1.5px solid #AFA9EC', marginTop:4 }}>social</div>}
                </div>
              )}

              {credits <= 2 && credits > 0 && (
                <div style={{ background:'#FAEEDA', borderRadius:12, padding:'10px 12px', marginBottom:10, fontSize:12, color:'#633806' }}>
                  <div style={{ fontWeight:500 }}>Only {credits} credit{credits!==1?'s':''} left</div>
                  <div style={{ fontSize:11, marginTop:2 }}>Top up to keep playing</div>
                </div>
              )}

              <button onClick={() => setPview('book')} style={{ width:'100%', padding:12, borderRadius:12, background:'#1D9E75', color:'#fff', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:8 }}>Book a session</button>

              {bookings.filter(b=>b.status==='upcoming').length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', margin:'14px 0 8px' }}>Coming up</div>
                  {bookings.filter(b=>b.status==='upcoming').slice(0,2).map(b => (
                    <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, background:'#f5f5f5', borderRadius:10, padding:'10px 12px', marginBottom:6 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:'#1D9E75', flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:500 }}>{b.name}</div>
                        <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{b.date} · {b.time}</div>
                      </div>
                      <div style={{ fontSize:11, color:'#0F6E56', fontWeight:500 }}>Booked</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {pview === 'book' && (
            <div style={{ paddingBottom:16 }}>
              <div style={{ paddingTop:14, paddingBottom:12 }}>
                <button onClick={() => setPview('home')} style={{ background:'none', border:'none', color:'#888', fontSize:12, cursor:'pointer', padding:0, marginBottom:4, fontFamily:'inherit' }}>← Back</button>
                <div style={{ fontSize:16, fontWeight:600, color:'#0a0a0a' }}>Book a session</div>
              </div>
              <div style={{ display:'inline-block', fontSize:11, padding:'2px 10px', borderRadius:20, background:'#E1F5EE', color:'#0F6E56', fontWeight:500, marginBottom:14 }}>{credits} credit{credits!==1?'s':''} available</div>
              {(() => {
                const days = [];
                const seen = {};
                SESSIONS.forEach(s => { if (!seen[s.day]) { seen[s.day] = true; days.push(s.day); } });
                return days.map(day => (
                  <div key={day} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                      {SESSIONS.find(s=>s.day===day).date}
                    </div>
                    {SESSIONS.filter(s=>s.day===day).map(s => {
                      const canAfford = credits >= s.credits;
                      const available = s.spots > 0 && canAfford;
                      return (
                        <button key={s.id} onClick={() => available && doBook(s)} disabled={!available} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'flex-start', background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'10px 12px', marginBottom:6, cursor:available?'pointer':'default', textAlign:'left', opacity:!available?0.45:1, fontFamily:'inherit' }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:500, color:'#0a0a0a' }}>{s.name}</div>
                            <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{s.time}–{s.end} · {s.level}</div>
                            <div style={{ fontSize:11, marginTop:3, color: s.spots===0?'#E24B4A':!canAfford?'#854F0B':'#0F6E56', fontWeight:500 }}>
                              {s.spots===0?'Full':!canAfford?'Not enough credits':`${s.spots} spot${s.spots!==1?'s':''} left`}
                            </div>
                          </div>
                          <div style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background: s.credits===1?'#E1F5EE':'#EEEDFE', color: s.credits===1?'#0F6E56':'#3C3489', fontWeight:500, whiteSpace:'nowrap', flexShrink:0, marginLeft:8, marginTop:2 }}>{s.credits === 1 ? '1 credit' : '1.5 credits'}</div>
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}

          {pview === 'confirm' && selected && (
            <div style={{ paddingBottom:16 }}>
              <div style={{ paddingTop:14, paddingBottom:12 }}>
                <button onClick={() => setPview('book')} style={{ background:'none', border:'none', color:'#888', fontSize:12, cursor:'pointer', padding:0, marginBottom:4, fontFamily:'inherit' }}>← Back</button>
                <div style={{ fontSize:16, fontWeight:600, color:'#0a0a0a' }}>Confirm booking</div>
              </div>
              <div style={{ background:'#f5f5f5', borderRadius:12, padding:14, marginBottom:14 }}>
                {[['Session',selected.name],['Level',selected.level],['Date',selected.date],['Time',selected.time+' – '+selected.end]].map(([k,v])=>(
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0' }}>
                    <span style={{ color:'#888' }}>{k}</span><span style={{ fontWeight:500, color:'#0a0a0a' }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop:'0.5px solid #e8e8e8', margin:'8px 0' }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0' }}>
                  <span style={{ color:'#888' }}>Cost</span><span style={{ color:'#0F6E56', fontWeight:600 }}>{selected.credits} credit{selected.credits!==1?'s':''}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0' }}>
                  <span style={{ color:'#888' }}>Credits after</span><span style={{ fontWeight:500 }}>{(credits - selected.credits).toFixed(1).replace('.0','')} remaining</span>
                </div>
              </div>
              <button onClick={doConfirm} style={{ width:'100%', padding:12, borderRadius:12, background:'#1D9E75', color:'#fff', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:8 }}>Confirm booking</button>
              <button onClick={() => setPview('book')} style={{ width:'100%', padding:12, borderRadius:12, background:'transparent', border:'0.5px solid #e0e0e0', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Choose different session</button>
            </div>
          )}

          {pview === 'success' && selected && (
            <div style={{ paddingBottom:16, textAlign:'center', paddingTop:'1.5rem' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'#E1F5EE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize:18, fontWeight:600, marginBottom:6, color:'#0a0a0a' }}>You're booked in</div>
              <div style={{ fontSize:12, color:'#888', marginBottom:20 }}>{selected.name} · {selected.date} · {selected.time}</div>
              <div style={{ background:'#f5f5f5', borderRadius:12, padding:14, marginBottom:14, textAlign:'left' }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:8, fontWeight:500 }}>Credits remaining</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {Array.from({length: Math.min(packTotal,12)}).map((_,i)=>(
                    <div key={i} style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:600, background: i<used?'#9FE1CB':'#fff', color: i<used?'#085041':'#0F6E56', border: i<used?'none':'1.5px solid #5DCAA5' }}>
                      {i<used?'✓':i+1}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:'#aaa', marginTop:8 }}>Confirmation sent to your email</div>
              </div>
              <button onClick={() => setPview('book')} style={{ width:'100%', padding:12, borderRadius:12, background:'#1D9E75', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:8 }}>Book another session</button>
              <button onClick={() => setPview('home')} style={{ width:'100%', padding:12, borderRadius:12, background:'transparent', border:'0.5px solid #e0e0e0', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Back to home</button>
            </div>
          )}

        </div>

        <nav style={{ display:'flex', borderTop:'0.5px solid #f0f0f0', padding:'8px 0 20px', background:'#fff' }}>
          {[{id:'home',l:'Home'},{id:'book',l:'Book'},{id:'history',l:'History'},{id:'account',l:'Account'}].map(n=>(
            <button key={n.id} onClick={() => setPview(n.id==='history'||n.id==='account'?'home':n.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px 0' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: pview===n.id?'#1D9E75':'transparent', marginBottom:1 }} />
              <span style={{ fontSize:10, color: pview===n.id?'#1D9E75':'#aaa' }}>{n.l}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
