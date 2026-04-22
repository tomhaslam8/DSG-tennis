'use client';
import { useState, useEffect } from 'react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export default function SessionManager({ supabase }) {
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [editId, setEditId]       = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [bookingsBySession, setBookingsBySession] = useState({});
  const [form, setForm] = useState({ name:'', level:'All levels', session_type:'lesson', credits_cost:1, day_of_week:0, start_time:'', end_time:'', capacity:8 });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('v_session_capacity')
      .select('*')
      .order('day_of_week')
      .order('start_time');
    setSessions(data || []);
    setLoading(false);
  }

  async function loadBookingsForSession(sessionId) {
    // Get next occurrence date for this session
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Find next date for this day_of_week
    const today = new Date();
    today.setHours(0,0,0,0);
    let daysAhead = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const jsDay = d.getDay();
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
      if (dayOfWeek === session.day_of_week) { daysAhead = i; break; }
    }
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysAhead);
    const dateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-${String(nextDate.getDate()).padStart(2,'0')}`;

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('id, player_id, session_date')
      .eq('session_id', sessionId)
      .eq('session_date', dateKey)
      .eq('status', 'confirmed')
      .order('created_at');

    // Fetch player details separately since FK may not be set up
    const playerIds = (bookingData || []).map(b => b.player_id);
    let playerMap = {};
    if (playerIds.length > 0) {
      const { data: playerData } = await supabase
        .from('players')
        .select('id, full_name, email, phone')
        .in('id', playerIds);
      (playerData || []).forEach(p => { playerMap[p.id] = p; });
    }

    const enriched = (bookingData || []).map(b => ({
      ...b,
      players: playerMap[b.player_id] || null,
    }));

    setBookingsBySession(prev => ({ ...prev, [sessionId]: { players: enriched, date: dateKey } }));
  }

  async function toggleExpand(sessionId) {
    if (expandedId === sessionId) {
      setExpandedId(null);
    } else {
      setExpandedId(sessionId);
      if (!bookingsBySession[sessionId]) {
        await loadBookingsForSession(sessionId);
      }
    }
  }

  async function saveSession() {
    if (editId) {
      await supabase.from('sessions').update(form).eq('id', editId);
    } else {
      await supabase.from('sessions').insert({ ...form, active: true });
    }
    setAdding(false);
    setEditId(null);
    setForm({ name:'', level:'All levels', session_type:'lesson', credits_cost:1, day_of_week:0, start_time:'', end_time:'', capacity:8 });
    load();
  }

  async function toggleActive(session) {
    await supabase.from('sessions').update({ active: !session.active }).eq('id', session.id);
    load();
  }

  async function rainCancel(session) {
    if (!window.confirm('Cancel this session due to rain? All players will be refunded their credits.')) return;
    
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, player_pack_id, credits_deducted')
      .eq('session_id', session.id)
      .eq('status', 'confirmed');

    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        const { data: pack } = await supabase
          .from('player_packs')
          .select('credits_used')
          .eq('id', booking.player_pack_id)
          .single();
        
        if (pack) {
          await supabase.from('player_packs')
            .update({ credits_used: Math.max(0, pack.credits_used - booking.credits_deducted) })
            .eq('id', booking.player_pack_id);
        }

        await supabase.from('bookings')
          .update({ status: 'cancelled', cancelled_reason: 'rain' })
          .eq('id', booking.id);
      }
    }

    await supabase.from('sessions')
      .update({ cancelled_date: new Date().toISOString().split('T')[0] })
      .eq('id', session.id);

    alert(`Session cancelled. ${bookings?.length || 0} players refunded.`);
    setBookingsBySession(prev => ({ ...prev, [session.id]: null }));
    load();
  }

  function startEdit(s) {
    setForm({ name: s.name, level: s.level, session_type: s.session_type, credits_cost: s.credits_cost, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, capacity: s.capacity });
    setEditId(s.id);
    setAdding(true);
  }

  if (loading) return <div style={{ fontSize:13, color:'#aaa' }}>Loading sessions...</div>;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:600 }}>Sessions</div>
        <button onClick={() => { setAdding(true); setEditId(null); }} style={{ fontSize:13, padding:'7px 16px', borderRadius:8, background:'#1D9E75', color:'#fff', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>+ Add session</button>
      </div>

      {adding && (
        <div style={{ background:'#f9f9f9', borderRadius:12, padding:16, marginBottom:20, border:'0.5px solid #e0e0e0' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>{editId ? 'Edit session' : 'New session'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>Session name</div>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Beginner clinic" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'0.5px solid #ddd', fontSize:13, fontFamily:'inherit' }}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>Level</div>
              <input value={form.level} onChange={e=>setForm(f=>({...f,level:e.target.value}))} placeholder="e.g. Beginner" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'0.5px solid #ddd', fontSize:13, fontFamily:'inherit' }}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>Day</div>
              <select value={form.day_of_week} onChange={e=>setForm(f=>({...f,day_of_week:+e.target.value}))} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'0.5px solid #ddd', fontSize:13, fontFamily:'inherit' }}>
                {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>Type</div>
              <select value={form.session_type} onChange={e=>setForm(f=>({...f,session_type:e.target.value}))} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'0.5px solid #ddd', fontSize:13, fontFamily:'inherit' }}>
                <option value="lesson">Lesson</option>
                <option value="social">Social</option>
                <option value="court_hire">Court hire</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>Start time</div>
              <input value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} placeholder="e.g. 7:00pm" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'0.5px solid #ddd', fontSize:13, fontFamily:'inherit' }}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>End time</div>
              <input value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} placeholder="e.g. 8:00pm" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'0.5px solid #ddd', fontSize:13, fontFamily:'inherit' }}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>Credits cost</div>
              <input type="number" value={form.credits_cost} onChange={e=>setForm(f=>({...f,credits_cost:+e.target.value}))} min="0.5" max="3" step="0.5" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'0.5px solid #ddd', fontSize:13, fontFamily:'inherit' }}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>Capacity</div>
              <input type="number" value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:+e.target.value}))} min="1" max="50" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'0.5px solid #ddd', fontSize:13, fontFamily:'inherit' }}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button onClick={saveSession} style={{ padding:'8px 20px', borderRadius:8, background:'#1D9E75', color:'#fff', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500, fontSize:13 }}>Save</button>
            <button onClick={() => { setAdding(false); setEditId(null); }} style={{ padding:'8px 16px', borderRadius:8, background:'transparent', border:'0.5px solid #e0e0e0', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>Cancel</button>
          </div>
        </div>
      )}

      {DAYS.map((day, di) => {
        const daySessions = sessions.filter(s => s.day_of_week === di);
        if (!daySessions.length) return null;
        return (
          <div key={di} style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{day}</div>
            {daySessions.map(s => {
              const pct = s.capacity > 0 ? Math.round((s.booked / s.capacity) * 100) : 0;
              const barCol = pct >= 100 ? '#E24B4A' : pct >= 75 ? '#BA7517' : '#1D9E75';
              const isExpanded = expandedId === s.id;
              const sessionBookings = bookingsBySession[s.id];
              return (
                <div key={s.id} style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:10, marginBottom:6, overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{s.name} <span style={{ fontSize:11, color:'#aaa', fontWeight:400 }}>· {s.level}</span></div>
                      <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{s.start_time}–{s.end_time} · {s.credits_cost} credit{s.credits_cost!==1?'s':''}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                        <div style={{ flex:1, height:4, background:'#f0f0f0', borderRadius:2 }}>
                          <div style={{ height:4, borderRadius:2, background:barCol, width:`${Math.min(pct,100)}%` }} />
                        </div>
                        <div style={{ fontSize:11, color:'#888', whiteSpace:'nowrap' }}>{s.booked}/{s.capacity}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={() => toggleExpand(s.id)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'0.5px solid #e0e0e0', background: isExpanded?'#f5f5f5':'transparent', cursor:'pointer', fontFamily:'inherit', color:'#0a0a0a' }}>
                        {isExpanded ? 'Hide' : 'Who\'s in'}
                      </button>
                      <button onClick={() => startEdit(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'0.5px solid #e0e0e0', background:'transparent', cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                      <button onClick={() => rainCancel(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'0.5px solid #4A90D9', color:'#4A90D9', background:'transparent', cursor:'pointer', fontFamily:'inherit' }}>🌧 Rain</button>
                      <button onClick={() => toggleActive(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'0.5px solid #e0e0e0', background: s.active===false?'#FAEEDA':'transparent', color: s.active===false?'#633806':'#888', cursor:'pointer', fontFamily:'inherit' }}>
                        {s.active === false ? 'Inactive' : 'Active'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop:'0.5px solid #f0f0f0', padding:'10px 12px', background:'#fafafa' }}>
                      {!sessionBookings ? (
                        <div style={{ fontSize:12, color:'#aaa' }}>Loading...</div>
                      ) : sessionBookings.players.length === 0 ? (
                        <div style={{ fontSize:12, color:'#aaa' }}>No bookings yet for {sessionBookings.date}</div>
                      ) : (
                        <>
                          <div style={{ fontSize:11, fontWeight:600, color:'#aaa', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                            Booked for {sessionBookings.date} · {sessionBookings.players.length} player{sessionBookings.players.length!==1?'s':''}
                          </div>
                          {sessionBookings.players.map((b, i) => (
                            <div key={b.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom: i < sessionBookings.players.length-1 ? '0.5px solid #f0f0f0' : 'none' }}>
                              <div>
                                <div style={{ fontSize:13, fontWeight:500 }}>{b.players?.full_name || 'Unknown'}</div>
                                <div style={{ fontSize:11, color:'#aaa' }}>{b.players?.email}</div>
                              </div>
                              {b.players?.phone && (
                                <a href={`tel:${b.players.phone}`} style={{ fontSize:12, color:'#1D9E75', textDecoration:'none', fontWeight:500 }}>{b.players.phone}</a>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
