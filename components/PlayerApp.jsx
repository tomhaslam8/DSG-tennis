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
  today.setHours(0,0,0,0);
  const sessions = [];
  let uid = 1;
  const seenDays = new Set();
  // Show next 14 days but only first occurrence of each day
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const d = new Date(today);
    d.setDate(today.getDate() + daysAhead);
    const jsDay = d.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
    if (seenDays.has(dayOfWeek)) continue;
    const daySessions = WEEKLY_TEMPLATE.filter(t => t.day === dayOfWeek);
    if (!daySessions.length) continue;
    seenDays.add(dayOfWeek);
    const dateStr = DAY_NAMES[dayOfWeek].slice(0,3) + " " + d.getDate() + " " + MONTHS[d.getMonth()];
    daySessions.forEach(t => {
      const seed = t.id * 7 + daysAhead * 13;
      const booked = Math.floor((Math.sin(seed) * 0.5 + 0.5) * (t.cap * 0.7));
      sessions.push({
        id: uid++, name: t.name, level: t.level,
        date: dateStr, day: DAY_NAMES[dayOfWeek],
        time: t.time, end: t.end,
        type: t.type, credits: t.credits,
        spots: t.cap - booked, cap: t.cap,
      });
    });
  }
  return sessions;
}

const SESSIONS = generateSessions();

export default function PlayerApp({ user, playerName, playerData }) {
  const [pview, setPview]       = useState('home');
  const [selected, setSelected] = useState(null);
  const [packData, setPackData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [bookings, setBookings] = useState([]);
  const [localStats, setLocalStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [hallOfFame, setHallOfFame] = useState([]);
  const [boardTab, setBoardTab] = useState('monthly');
  const [loadingBoard, setLoadingBoard] = useState(true);

  const rawName = playerName || user?.email?.split('@')[0] || 'there';
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  useEffect(() => {
    loadPackData();
    loadLeaderboard();
    if (playerData) setLocalStats({ total: playerData.total_sessions||0, monthly: playerData.sessions_this_month||0 });
  }, [user]);

  async function loadLeaderboard() {
    const [monthly, allTime] = await Promise.all([
      supabase.from('players').select('full_name, sessions_this_month, total_sessions, streak_weeks').order('sessions_this_month', { ascending: false }).limit(10),
      supabase.from('players').select('full_name, sessions_this_month, total_sessions, streak_weeks').order('total_sessions', { ascending: false }).limit(10),
    ]);
    if (monthly.data) setLeaderboard(monthly.data);
    if (allTime.data) setHallOfFame(allTime.data);
    setLoadingBoard(false);
  }

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

  async function cancelBooking(booking) {
    if (!window.confirm('Cancel this booking? Your credit will be refunded.')) return;
    // Refund credit
    const isSocial = booking.type === 'social';
    if (isSocial) {
      await supabase.from('player_packs').update({ social_credits: (packData.social_credits || 0) + 1 }).eq('id', packData.id);
      setPackData(p => ({ ...p, social_credits: (p.social_credits || 0) + 1 }));
    } else {
      await supabase.from('player_packs').update({ credits_used: packData.credits_used - 1 }).eq('id', packData.id);
      setPackData(p => ({ ...p, credits_used: p.credits_used - 1 }));
    }
    setBookings(bs => bs.filter(b => b.id !== booking.id));
  }

  function doBook(s) { setSelected(s); setPview('confirm'); }

  async function doConfirm() {
    const isSocial = selected.type === 'social';
    const useSocialCredit = isSocial && packData.social_credits > 0;
    const newUsed = useSocialCredit ? packData.credits_used : packData.credits_used + selected.credits;
    const newSocial = useSocialCredit ? packData.social_credits - 1 : packData.social_credits;
    await supabase.from('player_packs').update({ credits_used: newUsed, social_credits: newSocial }).eq('id', packData.id);
    setPackData(p => ({ ...p, credits_used: newUsed, social_credits: newSocial }));

    // Update player stats
    const newTotal = (playerData?.total_sessions || 0) + 1;
    const newMonthly = (playerData?.sessions_this_month || 0) + 1;
    await supabase.from('players').update({
      total_sessions: newTotal,
      sessions_this_month: newMonthly,
    }).eq('id', user.id);
    // Update local stats state
    setLocalStats({ total: newTotal, monthly: newMonthly });
    loadLeaderboard();
    // Save booking to database
    const { error: bookingError } = await supabase.from('bookings').insert({
      player_id:        user.id,
      player_pack_id:   packData.id,
      credits_deducted: isSocial && packData.social_credits > 0 ? 0 : selected.credits,
      status:           'confirmed',
      session_date:     new Date().toISOString().split('T')[0],
    });

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
              <div style={{ padding:'12px 0 10px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:11, color:'#aaa' }}>Good morning</div>
                  <div style={{ fontSize:22, fontWeight:600, lineHeight:1.2, marginTop:2, color:'#0a0a0a' }}>{firstName}</div>
                </div>
                {playerData?.streak_weeks > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', background:'#FFF3E0', borderRadius:12, padding:'8px 12px' }}>
                    <div style={{ fontSize:20 }}>🔥</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#E65100' }}>{playerData.streak_weeks}</div>
                    <div style={{ fontSize:9, color:'#BF360C', fontWeight:500 }}>WEEK STREAK</div>
                  </div>
                )}
              </div>

              {/* Personal stats bar */}
              {playerData && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                  <div style={{ background:'#f5f5f5', borderRadius:10, padding:'8px', textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:700, color:'#0a0a0a' }}>{localStats?.total ?? playerData.total_sessions ?? 0}</div>
                    <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>Total sessions</div>
                  </div>
                  <div style={{ background:'#f5f5f5', borderRadius:10, padding:'8px', textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:700, color: (localStats?.monthly ?? playerData.sessions_this_month ?? 0) > 0 ? '#1D9E75' : '#0a0a0a' }}>{localStats?.monthly ?? playerData.sessions_this_month ?? 0}</div>
                    <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>This month</div>
                  </div>
                  <div style={{ background:'#f5f5f5', borderRadius:10, padding:'8px', textAlign:'center' }}>
                    <div style={{ fontSize:18, fontWeight:700, color: (playerData.streak_weeks||0) > 0 ? '#E65100' : '#0a0a0a' }}>{playerData.streak_weeks || 0}</div>
                    <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>Week streak</div>
                  </div>
                </div>
              )}

              {/* Weekly goal progress */}
              {playerData?.play_frequency && (
                <div style={{ background:'#E1F5EE', borderRadius:12, padding:'10px 14px', marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#085041' }}>This week's goal</div>
                    <div style={{ fontSize:11, color:'#0F6E56' }}>{playerData.sessions_this_month || 0}/{playerData.play_frequency}x</div>
                  </div>
                  <div style={{ height:4, background:'#9FE1CB', borderRadius:2 }}>
                    <div style={{ height:4, background:'#0F6E56', borderRadius:2, width:`${Math.min(((playerData.sessions_this_month||0)/parseInt(playerData.play_frequency))*100,100)}%`, transition:'width 0.4s' }} />
                  </div>
                </div>
              )}

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
                    {socialCredits > 0 && <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:600, background:'#EEEDFE', color:'#3C3489', border:'1.5px solid #AFA9EC' }}>social</div>}
                  </div>
                  <div style={{ height:4, background:'#9FE1CB', borderRadius:2, marginBottom:4 }}>
                    <div style={{ height:4, background:'#0F6E56', borderRadius:2, width:`${Math.min((used/packTotal)*100,100)}%` }} />
                  </div>
                  <div style={{ fontSize:10, color:'#0F6E56' }}>{used} of {packTotal} used</div>
                </div>
              )}

              {credits <= 2 && credits > 0 && (
                <div style={{ background:'#FAEEDA', borderRadius:12, padding:'10px 12px', marginBottom:10, fontSize:12, color:'#633806' }}>
                  <div style={{ fontWeight:500 }}>Only {credits} credit{credits!==1?'s':''} left</div>
                  <div style={{ fontSize:11, marginTop:2 }}>Top up to keep playing</div>
                </div>
              )}

              <button onClick={() => setPview('book')} style={{ width:'100%', padding:12, borderRadius:12, background:'#1D9E75', color:'#fff', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:8 }}>Book a session</button>

              {/* Leaderboard */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', gap:6, margin:'14px 0 10px' }}>
                  <button onClick={()=>setBoardTab('monthly')} style={{ fontSize:11, padding:'3px 12px', borderRadius:20, border:'0.5px solid #e0e0e0', background: boardTab==='monthly'?'#1D9E75':'transparent', color: boardTab==='monthly'?'#fff':'#888', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>This month</button>
                  <button onClick={()=>setBoardTab('alltime')} style={{ fontSize:11, padding:'3px 12px', borderRadius:20, border:'0.5px solid #e0e0e0', background: boardTab==='alltime'?'#1D9E75':'transparent', color: boardTab==='alltime'?'#fff':'#888', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>All time 🏆</button>
                </div>
                {boardTab === 'monthly' && !leaderboard.some(p => (p.sessions_this_month||0) > 0) ? (
                  <div onClick={() => setPview('book')} style={{ background:'#f5f5f5', borderRadius:12, padding:'14px', textAlign:'center', cursor:'pointer' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#0a0a0a', marginBottom:4 }}>No one's on the board yet</div>
                    <div style={{ fontSize:12, color:'#1D9E75', fontWeight:500 }}>Book a session to be first →</div>
                  </div>
                ) : (boardTab === 'monthly' ? leaderboard : hallOfFame).map((p, i) => {
                  const nameParts = (p.full_name || 'Player').split(' ');
                  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
                  const display = nameParts.length > 1 ? cap(nameParts[0]) + ' ' + nameParts[1][0].toUpperCase() + '.' : cap(nameParts[0]);
                  const isMe = p.full_name === playerName;
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background: isMe ? '#E1F5EE' : i===0 ? '#FFFDE7' : 'transparent', marginBottom:4 }}>
                      <div style={{ fontSize:13, fontWeight:700, color: i===0?'#F9A825':i===1?'#9E9E9E':i===2?'#8D6E63':'#aaa', minWidth:20, textAlign:'center' }}>
                        {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                      </div>
                      <div style={{ flex:1, fontSize:13, fontWeight: isMe?600:400, color: isMe?'#085041':'#0a0a0a' }}>{display}{isMe?' (you)':''}</div>
                      <div style={{ fontSize:12, fontWeight:600, color: isMe?'#0F6E56':'#888' }}>{boardTab==='monthly' ? (p.sessions_this_month||0) : (p.total_sessions||0)} session{((boardTab==='monthly'?(p.sessions_this_month||0):(p.total_sessions||0)) !== 1) ? 's' : ''}</div>
                    </div>
                  );
                })}
              </div>

{bookings.filter(b=>b.status==='upcoming').length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', margin:'14px 0 8px' }}>Coming up</div>
                  {bookings.filter(b=>b.status==='upcoming').slice(0,2).map(b => {
                    const sessionDateTime = b.sessionDate ? new Date(b.sessionDate) : null;
                    const hoursUntil = sessionDateTime ? (sessionDateTime - new Date()) / 3600000 : 999;
                    const canCancel = hoursUntil > 12;
                    return (
                      <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, background:'#f5f5f5', borderRadius:10, padding:'10px 12px', marginBottom:6 }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background:'#1D9E75', flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:500 }}>{b.name}</div>
                          <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{b.date} · {b.time}</div>
                        </div>
                        {canCancel ? (
                          <button onClick={() => cancelBooking(b)} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'0.5px solid #e0e0e0', background:'transparent', color:'#E24B4A', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                        ) : (
                          <span style={{ fontSize:10, color:'#854F0B', fontWeight:500, background:'#FAEEDA', padding:'2px 7px', borderRadius:20 }}>Locked</span>
                        )}
                      </div>
                    );
                  })}
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
                      const hasSocialCredit = socialCredits > 0;
                      const canAfford = (s.type === 'social' && !hasSocialCredit) ? credits >= 1 : s.type === 'social' ? true : credits >= s.credits;
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
                          <div style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background: s.type==='social'&&socialCredits>0?'#EEEDFE':s.credits===1?'#E1F5EE':'#EEEDFE', color: s.type==='social'&&socialCredits>0?'#3C3489':s.credits===1?'#0F6E56':'#3C3489', fontWeight:500, whiteSpace:'nowrap', flexShrink:0, marginLeft:8, marginTop:2 }}>{s.type === 'social' ? (socialCredits > 0 ? '1 social credit' : '1 credit') : s.credits === 1 ? '1 credit' : '1.5 credits'}</div>
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

        {pview === 'history' && (
            <div style={{ paddingBottom:16 }}>
              <div style={{ paddingTop:14, paddingBottom:12 }}>
                <div style={{ fontSize:16, fontWeight:600, color:'#0a0a0a' }}>Session history</div>
              </div>
              {bookings.length === 0 ? (
                <div style={{ textAlign:'center', padding:'2rem 0', color:'#aaa', fontSize:13 }}>No sessions booked yet</div>
              ) : [...bookings].reverse().map(b => (
                <div key={b.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'0.5px solid #f0f0f0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background: b.status==='upcoming'?'#1D9E75':'#9FE1CB', flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{b.name}</div>
                      <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{b.date} · {b.time}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500, background: b.status==='upcoming'?'#E6F1FB':'#E1F5EE', color: b.status==='upcoming'?'#0C447C':'#0F6E56' }}>
                    {b.status==='upcoming'?'Upcoming':'Attended'}
                  </div>
                </div>
              ))}
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
