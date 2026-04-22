'use client';
import { useState, useEffect } from 'react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export default function SessionManager({ supabase }) {
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState({ name:'', level:'All levels', session_type:'lesson', credits_cost:1, day_of_week:0, start_time:'', end_time:'', capacity:8 });

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
    
    // Get all confirmed bookings for this session
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, player_pack_id, credits_deducted')
      .eq('session_id', session.id)
      .eq('status', 'confirmed');

    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        // Refund credit to player pack
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

        // Cancel the booking
        await supabase.from('bookings')
          .update({ status: 'cancelled', cancelled_reason: 'rain' })
          .eq('id', booking.id);
      }
    }

    // Mark session as cancelled today
    await supabase.from('sessions')
      .update({ cancelled_date: new Date().toISOString().split('T')[0] })
      .eq('id', session.id);

    alert(`Session cancelled. ${bookings?.length || 0} players refunded.`);
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

      {/* Add / Edit form */}
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

      {/* Session list grouped by day */}
      {DAYS.map((day, di) => {
        const daySessions = sessions.filter(s => s.day_of_week === di);
        if (!daySessions.length) return null;
        return (
          <div key={di} style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{day}</div>
            {daySessions.map(s => {
              const pct = s.capacity > 0 ? Math.round((s.booked / s.capacity) * 100) : 0;
              const barCol = pct >= 100 ? '#E24B4A' : pct >= 75 ? '#BA7517' : '#1D9E75';
              return (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:10, marginBottom:6 }}>
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
                    <button onClick={() => startEdit(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'0.5px solid #e0e0e0', background:'transparent', cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
                    <button onClick={() => rainCancel(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'0.5px solid #4A90D9', color:'#4A90D9', background:'transparent', cursor:'pointer', fontFamily:'inherit' }}>🌧 Rain</button>
                    <button onClick={() => toggleActive(s)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'0.5px solid #e0e0e0', background: s.active===false?'#FAEEDA':'transparent', color: s.active===false?'#633806':'#888', cursor:'pointer', fontFamily:'inherit' }}>
                      {s.active === false ? 'Inactive' : 'Active'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
