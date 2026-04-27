'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  const [confirming, setConfirming] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [editingPhone, setEditingPhone] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');

  const rawName = playerName || user?.email?.split('@')[0] || 'there';
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  useEffect(() => {
    loadPackData();
    loadLeaderboard();
    loadBookings();
    loadSessions();
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

  async function loadBookings() {
    const { data } = await supabase
      .from('bookings')
      .select('*, session_datetime')
      .eq('player_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      setBookings(data.filter(b => b.status !== 'cancelled').map(b => ({
        id: b.id,
        name: b.session_name || 'Session',
        date: b.session_date ? new Date(b.session_date).toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short' }) : (b.session_datetime ? new Date(b.session_datetime).toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short' }) : 'Date TBC'),
        time: b.session_time || '',
        status: b.status === 'confirmed' ? 'upcoming' : 'attended',
        type: b.session_type || 'lesson',
        sessionDate: b.session_datetime || null,
        credits: b.credits_deducted || 1,
      })));
    }
  }

  async function loadSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('id, name, level, session_type, credits_cost, day_of_week, start_time, end_time, capacity, active')
      .eq('active', true)
      .order('day_of_week')
      .order('start_time');
    if (!data || !data.length) return;

    // Get real booking counts for each session for the next 14 days
    const today = new Date();
    today.setHours(0,0,0,0);
    const in14 = new Date(today);
    in14.setDate(today.getDate() + 14);

    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const in14Key = `${in14.getFullYear()}-${String(in14.getMonth()+1).padStart(2,'0')}-${String(in14.getDate()).padStart(2,'0')}`;

    const { data: bookingCounts } = await supabase
      .from('bookings')
      .select('session_id, session_date')
      .eq('status', 'confirmed')
      .gte('session_date', todayKey)
      .lte('session_date', in14Key);

    // Count bookings per session_id per date
    const countMap = {};
    (bookingCounts || []).forEach(b => {
      const key = `${b.session_id}|${b.session_date}`;
      countMap[key] = (countMap[key] || 0) + 1;
    });

    const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const built = [];
    const seenDays = new Set();

    for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
      const d = new Date(today);
      d.setDate(today.getDate() + daysAhead);
      const jsDay = d.getDay();
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
      if (seenDays.has(dayOfWeek)) continue;
      const daySessions = data.filter(s => s.day_of_week === dayOfWeek);
      if (!daySessions.length) continue;
      seenDays.add(dayOfWeek);
      const dateStr = DAY_NAMES[dayOfWeek].slice(0,3) + " " + d.getDate() + " " + MONTHS[d.getMonth()];
      const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      daySessions.forEach(s => {
        const booked = countMap[`${s.id}|${dateKey}`] || 0;
        built.push({ id: s.id, name: s.name, level: s.level, date: dateStr, day: DAY_NAMES[dayOfWeek], time: s.start_time, end: s.end_time, type: s.session_type, credits: s.credits_cost, spots: Math.max(0, s.capacity - booked), cap: s.capacity });
      });
    }
    setSessions(built);
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
      .maybeSingle();
    setPackData(data);
    if (data) setAutoRenew(data.auto_renew !== false);
    setLoading(false);
    if (data) {
      const creditsLeft = data.credits_total - data.credits_used;
      const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
      // Discover pack complete or expired → upgrade page
      if (data.packs?.name === 'Discover' && (creditsLeft <= 0 || isExpired)) {
        window.location.href = '/upgrade';
      }
      // Join 10 expired → purchase page with message
      if (data.packs?.name === 'Join 10' && isExpired) {
        window.location.href = '/purchase?expired=true';
      }
    } else {
      // No active pack at all
      // Don't redirect — show "get started" CTA on home screen
    }
  }

  const credits = packData ? packData.credits_total - packData.credits_used : 0;
  const socialCredits = packData?.social_credits || 0;
  const packTotal = packData?.credits_total || 12;
  const packName = packData?.packs?.name || 'No active pack';
  const used = packTotal - credits;

  async function cancelBooking(booking) {
    if (!window.confirm(`Cancel this booking? Your ${booking.credits === 1.5 ? '1.5 credits' : 'credit'} will be refunded.`)) return;
    const isSocial = booking.type === 'social';
    const isDiscover = packData?.packs?.name === 'Discover';

    // Fetch the actual credits_deducted from the booking record
    const { data: bookingRecord } = await supabase
      .from('bookings')
      .select('credits_deducted')
      .eq('id', booking.id)
      .single();
    const creditsToRefund = bookingRecord?.credits_deducted ?? booking.credits ?? 1;

    if (isSocial && isDiscover && creditsToRefund === 0) {
      // Was paid with a social credit — refund the social credit
      const newSocialCredits = Math.min(1, (packData.social_credits || 0) + 1);
      await supabase.from('player_packs').update({ social_credits: newSocialCredits }).eq('id', packData.id);
      setPackData(p => ({ ...p, social_credits: newSocialCredits }));
    } else {
      // Refund exact credits deducted
      const newUsedAfterCancel = Math.max(0, packData.credits_used - creditsToRefund);
      await supabase.from('player_packs').update({ credits_used: newUsedAfterCancel }).eq('id', packData.id);
      setPackData(p => ({ ...p, credits_used: newUsedAfterCancel }));
    }
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
    setBookings(bs => bs.filter(b => b.id !== booking.id));
    const currentTotal = localStats?.total ?? playerData?.total_sessions ?? 0;
    const currentMonthly = localStats?.monthly ?? playerData?.sessions_this_month ?? 0;
    const newTotal = Math.max(0, currentTotal - 1);
    const newMonthly = Math.max(0, currentMonthly - 1);
    await supabase.from('players').update({
      total_sessions: newTotal,
      sessions_this_month: newMonthly,
    }).eq('id', user.id);
    setLocalStats({ total: newTotal, monthly: newMonthly });
    loadLeaderboard();
  }

  async function savePhone() {
    const phone = phoneInput.trim() || null;
    await supabase.from('players').update({ phone }).eq('id', user.id);
    playerData.phone = phone;
    setEditingPhone(false);
  }

  function doBook(s) { setSelected(s); setPview('confirm'); }

  async function doConfirm() {
    if (confirming) return;
    // Check for duplicate booking
    const sessionDateKey = selected.date;
    const alreadyBooked = bookings.some(b => b.status === 'upcoming' && b.name === selected.name && b.date === sessionDateKey);
    if (alreadyBooked) {
      alert("You're already booked into this session.");
      return;
    }
    setConfirming(true);
    const isSocial = selected.type === 'social';
    const isDiscover = packData?.packs?.name === 'Discover';
    const useSocialCredit = isSocial && isDiscover && packData.social_credits > 0;
    const newUsed = useSocialCredit ? packData.credits_used : packData.credits_used + selected.credits;
    const newSocial = useSocialCredit ? packData.social_credits - 1 : packData.social_credits;

    // Calculate real session datetime first
    const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    let sessionDate = null;
    try {
      const parts = selected.date.split(' ');
      sessionDate = new Date();
      sessionDate.setMonth(months[parts[2]]);
      sessionDate.setDate(parseInt(parts[1]));
      const timeParts = selected.time.match(/(\d+):(\d+)(am|pm)/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1]);
        const mins = parseInt(timeParts[2]);
        if (timeParts[3].toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (timeParts[3].toLowerCase() === 'am' && hours === 12) hours = 0;
        sessionDate.setHours(hours, mins, 0, 0);
      }
    } catch(e) { sessionDate = null; }

    // Update pack credits
    await supabase.from('player_packs').update({ credits_used: newUsed, social_credits: newSocial }).eq('id', packData.id);

    // Update player stats
    const newTotal = (localStats?.total ?? playerData?.total_sessions ?? 0) + 1;
    const newMonthly = (localStats?.monthly ?? playerData?.sessions_this_month ?? 0) + 1;
    await supabase.from('players').update({
      total_sessions: newTotal,
      sessions_this_month: newMonthly,
    }).eq('id', user.id);

    // Save booking to database
    await supabase.from('bookings').insert({
      player_id:        user.id,
      player_pack_id:   packData.id,
      session_id:       selected.id,
      credits_deducted: useSocialCredit ? 0 : selected.credits,
      status:           'confirmed',
      session_date:     sessionDate ? `${sessionDate.getFullYear()}-${String(sessionDate.getMonth()+1).padStart(2,'0')}-${String(sessionDate.getDate()).padStart(2,'0')}` : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`,
      session_datetime: sessionDate ? sessionDate.toISOString() : null,
      session_name:     selected.name,
      session_time:     selected.time,
      session_type:     selected.type,
    });

    // Update all local state (no page reload needed)
    setPackData(p => ({ ...p, credits_used: newUsed, social_credits: newSocial }));
    setLocalStats({ total: newTotal, monthly: newMonthly });
    setBookings(b => [{ id: Date.now(), name: selected.name, date: selected.date, time: selected.time, status: 'upcoming', sessionDate: sessionDate ? sessionDate.toISOString() : null, type: selected.type, credits: useSocialCredit ? 0 : selected.credits }, ...b]);
    loadLeaderboard();
    loadSessions();

    // GHL email triggers (fire and forget — won't affect booking if they fail)
    const creditsLeft = packData.credits_total - newUsed;
    const ghlData = { firstName, sessionName: selected.name, sessionDate: selected.date, sessionTime: selected.time, creditsRemaining: creditsLeft };
    fetch('/api/ghl-event', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ trigger:'booking_confirmation', email: user.email, firstName, data: ghlData }) }).catch(()=>{});
    if (creditsLeft === 3 && packName === 'Join 10') {
      fetch('/api/ghl-event', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ trigger:'low_credits_3', email: user.email, firstName, data: { firstName } }) }).catch(()=>{});
    }
    if (creditsLeft === 1 && packName === 'Join 10') {
      fetch('/api/ghl-event', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ trigger:'low_credits_1', email: user.email, firstName, data: { firstName } }) }).catch(()=>{});
    }
    if (creditsLeft <= 0 && packName === 'Discover') {
      fetch('/api/ghl-event', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ trigger:'discover_complete', email: user.email, firstName, data: { firstName } }) }).catch(()=>{});
    }

    setConfirming(false);
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
                  <div style={{ fontSize:11, color:'#aaa' }}>
                    {(() => {
                      const hour = new Date().getHours();
                      const sessions = localStats?.total ?? playerData?.total_sessions ?? 0;
                      const streak = playerData?.streak_weeks || 0;
                      const todayStr = new Date().getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()];
                      const hasTonight = bookings.some(b => b.status==='upcoming' && b.date && b.date.includes(todayStr) && (!b.sessionDate || new Date(b.sessionDate) > new Date()));
                      if (hasTonight) return "You're playing tonight 🎾";
                      if (streak >= 3) return streak + " week streak — keep it going 🔥";
                      if (sessions === 0) return "Welcome to DSG Tennis 👋";
                      if (sessions >= 10 && sessions % 10 === 0) return sessions + " sessions — legend 🏆";
                      if (hour < 12) return "Good morning";
                      if (hour < 17) return "Good afternoon";
                      return "Good evening";
                    })()}
                  </div>
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
                    <div style={{ fontSize:11, color:'#0F6E56' }}>{localStats?.monthly ?? playerData.sessions_this_month ?? 0}/{playerData.play_frequency}x</div>
                  </div>
                  <div style={{ height:4, background:'#9FE1CB', borderRadius:2 }}>
                    <div style={{ height:4, background:'#0F6E56', borderRadius:2, width:`${Math.min(((localStats?.monthly ?? playerData.sessions_this_month ?? 0)/parseInt(playerData.play_frequency))*100,100)}%`, transition:'width 0.4s' }} />
                  </div>
                </div>
              )}

              {!packData ? (
                <div style={{ background:'#f5f5f5', borderRadius:16, padding:16, marginBottom:10, textAlign:'center' }}>
                  <div style={{ fontSize:13, color:'#666', marginBottom:12 }}>You don't have an active pack yet.</div>
                  <button onClick={() => window.location.href='/purchase?expired=true'} style={{ padding:'10px 20px', borderRadius:12, background:'#1D9E75', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer' }}>Get started</button>
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
                    {socialCredits > 0 && packName === 'Discover' && <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:600, background:'#EEEDFE', color:'#3C3489', border:'1.5px solid #AFA9EC' }}>social</div>}
                  </div>
                  <div style={{ height:4, background:'#9FE1CB', borderRadius:2, marginBottom:4 }}>
                    <div style={{ height:4, background:'#0F6E56', borderRadius:2, width:`${Math.min((used/packTotal)*100,100)}%` }} />
                  </div>
                  <div style={{ fontSize:10, color:'#0F6E56' }}>{used} of {packTotal} used</div>
                </div>
              )}

              {credits <= 3 && credits > 0 && packName === 'Discover' && (
                <div onClick={() => window.location.href='/upgrade'} style={{ background:'#FAEEDA', borderRadius:12, padding:'10px 12px', marginBottom:10, fontSize:12, color:'#633806', cursor:'pointer' }}>
                  <div style={{ fontWeight:600 }}>Only {credits} credit{credits!==1?'s':''} left on your Discover pack</div>
                  <div style={{ fontSize:11, marginTop:2 }}>Tap to upgrade to Join 10 →</div>
                </div>
              )}
              {credits <= 3 && credits > 0 && packName === 'Join 10' && (
                <div style={{ background:'#FAEEDA', borderRadius:12, padding:'10px 12px', marginBottom:10, fontSize:12, color:'#633806' }}>
                  <div style={{ fontWeight:600 }}>Only {credits} credit{credits!==1?'s':''} left</div>
                  <div style={{ fontSize:11, marginTop:2 }}>Your pack will auto-renew after your last session</div>
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

{bookings.filter(b=>b.status==='upcoming' && (!b.sessionDate || new Date(b.sessionDate) > new Date())).length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', margin:'14px 0 8px' }}>Coming up</div>
                  {bookings.filter(b=>b.status==='upcoming' && (!b.sessionDate || new Date(b.sessionDate) > new Date())).slice(0,2).map(b => {
                    const sessionDateTime = b.sessionDate ? new Date(b.sessionDate) : null;
                    const hoursUntil = sessionDateTime ? (new Date(sessionDateTime) - new Date()) / 3600000 : 999;
                    const canCancel = hoursUntil > 12;
                    const startingSoon = hoursUntil > 0 && hoursUntil <= 2;
                    const hoursLabel = hoursUntil < 1 ? 'Under 1hr away' : `${Math.floor(hoursUntil)}hr${Math.floor(hoursUntil)!==1?'s':''} away`;
                    return (
                      <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, background: startingSoon ? '#E1F5EE' : '#f5f5f5', borderRadius:10, padding:'10px 12px', marginBottom:6, border: startingSoon ? '1.5px solid #1D9E75' : '1.5px solid transparent' }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background:'#1D9E75', flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ fontSize:12, fontWeight:500 }}>{b.name}</div>
                            {startingSoon && <span style={{ fontSize:10, fontWeight:600, color:'#0F6E56', background:'#fff', padding:'1px 7px', borderRadius:20 }}>Starting soon · {hoursLabel}</span>}
                          </div>
                          <div style={{ fontSize:11, color: startingSoon ? '#0F6E56' : '#888', marginTop:1 }}>{b.date} · {b.time}</div>
                        </div>
                        {canCancel ? (
                          <button onClick={() => cancelBooking(b)} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'0.5px solid #e0e0e0', background:'transparent', color:'#E24B4A', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                        ) : (
                          <div style={{ textAlign:'right' }}>
                          <span style={{ fontSize:10, color:'#854F0B', fontWeight:500, background:'#FAEEDA', padding:'2px 7px', borderRadius:20, display:'block' }}>Locked</span>
                          <span style={{ fontSize:9, color:'#aaa', marginTop:2, display:'block' }}>Within 12hrs</span>
                        </div>
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
              {sessions.length === 0 ? (
                <div style={{ textAlign:'center', padding:'2rem 0', color:'#aaa', fontSize:13 }}>Loading sessions...</div>
              ) : (() => {
                const days = [];
                const seen = {};
                sessions.forEach(s => { if (!seen[s.day]) { seen[s.day] = true; days.push(s.day); } });
                return days.map(day => (
                  <div key={day} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                      {sessions.find(s=>s.day===day).date}
                    </div>
                    {sessions.filter(s=>s.day===day).map(s => {
                      const hasSocialCredit = packName === 'Discover' && socialCredits > 0;
                      const canAfford = (s.type === 'social' && !hasSocialCredit) ? credits >= 1 : s.type === 'social' ? true : credits >= s.credits;
                      const available = s.spots > 0 && canAfford;
                      return (
                        <div key={s.id} style={{ marginBottom:6 }}>
                          <button onClick={() => available && doBook(s)} disabled={!available} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'flex-start', background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'10px 12px', cursor:available?'pointer':'default', textAlign:'left', opacity: s.spots===0 ? 0.45 : 1, fontFamily:'inherit' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:500, color:'#0a0a0a' }}>{s.name}</div>
                              <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{s.time}–{s.end} · {s.level}</div>
                              <div style={{ fontSize:11, marginTop:3, color: s.spots===0?'#E24B4A':'#0F6E56', fontWeight:500 }}>
                                {s.spots===0?'Full':`${s.spots} spot${s.spots!==1?'s':''} left`}
                              </div>
                            </div>
                            <div style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background: s.type==='social'&&socialCredits>0?'#EEEDFE':s.credits===1?'#E1F5EE':'#EEEDFE', color: s.type==='social'&&socialCredits>0?'#3C3489':s.credits===1?'#0F6E56':'#3C3489', fontWeight:500, whiteSpace:'nowrap', flexShrink:0, marginLeft:8, marginTop:2 }}>{s.type === 'social' ? (socialCredits > 0 ? '1 social credit' : '1 credit') : s.credits === 1 ? '1 credit' : '1.5 credits'}</div>
                          </button>
                          {!canAfford && s.spots > 0 && (
                            <button onClick={() => window.location.href='/purchase?expired=true'} style={{ width:'100%', padding:'8px 12px', borderRadius:8, background:'#0F6E56', color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginTop:4 }}>
                              Not enough credits — top up →
                            </button>
                          )}
                        </div>
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
              <button onClick={doConfirm} disabled={confirming} style={{ width:'100%', padding:12, borderRadius:12, background: confirming ? '#9FE1CB' : '#1D9E75', color:'#fff', border:'none', fontSize:14, fontWeight:600, cursor: confirming ? 'default' : 'pointer', marginBottom:8 }}>{confirming ? 'Booking...' : 'Confirm booking'}</button>
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

        {pview === 'account' && (
            <div style={{ paddingBottom:16 }}>
              <div style={{ paddingTop:14, paddingBottom:12 }}>
                <div style={{ fontSize:16, fontWeight:600, color:'#0a0a0a' }}>Account</div>
              </div>

              <div style={{ background:'#f5f5f5', borderRadius:16, padding:16, marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                  <div style={{ width:48, height:48, borderRadius:'50%', background:'#1D9E75', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:600, color:'#0a0a0a' }}>{firstName}</div>
                    <div style={{ fontSize:12, color:'#aaa' }}>{user?.email}</div>
                  </div>
                </div>
                {[
                  { label:'Level', value: playerData?.skill_level ? playerData.skill_level.charAt(0).toUpperCase() + playerData.skill_level.slice(1) : '—' },
                  { label:'Weekly goal', value: playerData?.play_frequency ? playerData.play_frequency + 'x per week' : '—' },
                  { label:'Play goal', value: playerData?.play_goal ? (playerData.play_goal === 'all' ? 'All of the above' : playerData.play_goal.charAt(0).toUpperCase() + playerData.play_goal.slice(1)) : '—' },
                  { label:'Member since', value: playerData?.created_at ? new Date(playerData.created_at).toLocaleDateString('en-AU', { month:'long', year:'numeric' }) : '—' },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'0.5px solid #ebebeb' }}>
                    <span style={{ fontSize:13, color:'#888' }}>{item.label}</span>
                    <span style={{ fontSize:13, fontWeight:500, color:'#0a0a0a' }}>{item.value}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0' }}>
                  <span style={{ fontSize:13, color:'#888' }}>Mobile</span>
                  {editingPhone ? (
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={e => setPhoneInput(e.target.value)}
                        placeholder="04xx xxx xxx"
                        autoFocus
                        style={{ fontSize:13, padding:'4px 8px', borderRadius:8, border:'0.5px solid #1D9E75', fontFamily:'inherit', width:130, outline:'none' }}
                      />
                      <button onClick={savePhone} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'#1D9E75', color:'#fff', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Save</button>
                      <button onClick={() => setEditingPhone(false)} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'transparent', border:'0.5px solid #e0e0e0', cursor:'pointer', fontFamily:'inherit' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ fontSize:13, fontWeight:500, color: playerData?.phone ? '#0a0a0a' : '#aaa' }}>{playerData?.phone || 'Add mobile'}</span>
                      <button onClick={() => { setPhoneInput(playerData?.phone || ''); setEditingPhone(true); }} style={{ fontSize:11, padding:'2px 8px', borderRadius:6, border:'0.5px solid #e0e0e0', background:'transparent', cursor:'pointer', fontFamily:'inherit', color:'#888' }}>Edit</button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background:'#f5f5f5', borderRadius:16, padding:16, marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#0a0a0a', marginBottom:12 }}>Your stats</div>
                {[
                  { label:'Total sessions', value: localStats?.total ?? playerData?.total_sessions ?? 0 },
                  { label:'This month', value: localStats?.monthly ?? playerData?.sessions_this_month ?? 0 },
                  { label:'Week streak', value: (playerData?.streak_weeks || 0) + ' weeks' },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'0.5px solid #ebebeb' }}>
                    <span style={{ fontSize:13, color:'#888' }}>{item.label}</span>
                    <span style={{ fontSize:13, fontWeight:500, color:'#0a0a0a' }}>{item.value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => window.location.href='/onboard'}
                style={{ width:'100%', padding:12, borderRadius:12, background:'transparent', border:'0.5px solid #e0e0e0', fontSize:13, color:'#0a0a0a', cursor:'pointer', fontFamily:'inherit', marginBottom:8 }}
              >
                Update my goals
              </button>

              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href='/login'; }}
                style={{ width:'100%', padding:12, borderRadius:12, background:'transparent', border:'0.5px solid #FCEBEB', fontSize:13, color:'#E24B4A', cursor:'pointer', fontFamily:'inherit' }}
              >
                Sign out
              </button>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderTop:'0.5px solid #f0f0f0', marginTop:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>Auto-renew</div>
                  <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>Automatically reload credits when pack runs out</div>
                </div>
                <button
                  onClick={async () => {
                    const newVal = !autoRenew;
                    setAutoRenew(newVal);
                    await supabase.from('player_packs').update({ auto_renew: newVal }).eq('id', packData.id);
                  }}
                  style={{ width:44, height:24, borderRadius:12, background: autoRenew ? '#1D9E75' : '#e0e0e0', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}
                >
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left: autoRenew ? 23 : 3, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            </div>
          )}

        {pview === 'history' && (
            <div style={{ paddingBottom:16 }}>
              <div style={{ paddingTop:14, paddingBottom:12 }}>
                <div style={{ fontSize:16, fontWeight:600, color:'#0a0a0a' }}>Session history</div>
              </div>
              {bookings.length === 0 ? (
                <div style={{ textAlign:'center', padding:'2rem 0', color:'#aaa', fontSize:13 }}>No sessions booked yet</div>
              ) : [...bookings].reverse().map(b => {
                const isPast = b.sessionDate ? new Date(b.sessionDate) < new Date() : false;
                const displayStatus = isPast ? 'attended' : 'upcoming';
                return (
                  <div key={b.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'0.5px solid #f0f0f0' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background: displayStatus==='upcoming'?'#1D9E75':'#9FE1CB', flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{b.name}</div>
                        <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{b.date} · {b.time}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500, background: displayStatus==='upcoming'?'#E6F1FB':'#E1F5EE', color: displayStatus==='upcoming'?'#0C447C':'#0F6E56' }}>
                      {displayStatus==='upcoming'?'Upcoming':'Attended'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}


        </div>

        <nav style={{ display:'flex', borderTop:'0.5px solid #f0f0f0', padding:'8px 0 20px', background:'#fff' }}>
          {[{id:'home',l:'Home'},{id:'book',l:'Book'},{id:'history',l:'History'},{id:'account',l:'Account'}].map(n=>(
            <button key={n.id} onClick={() => setPview(n.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px 0' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: pview===n.id?'#1D9E75':'transparent', marginBottom:1 }} />
              <span style={{ fontSize:10, color: pview===n.id?'#1D9E75':'#aaa' }}>{n.l}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
