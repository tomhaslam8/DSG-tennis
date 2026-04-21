'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminDashboard() {
  const [players, setPlayers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('players');
  const [filter, setFilter]     = useState('all');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await supabase
      .from('players')
      .select(`
        id, full_name, email, total_sessions, sessions_this_month,
        streak_weeks, play_frequency, skill_level, created_at,
        player_packs (
          id, credits_total, credits_used, credits_remaining,
          status, auto_renew, expires_at, purchased_at,
          packs ( name )
        )
      `)
      .order('created_at', { ascending: false });
    setPlayers(data || []);
    setLoading(false);
  }

  function getActivePack(p) {
    return p.player_packs?.find(pp => pp.status === 'active');
  }

  function getStatus(p) {
    const pack = getActivePack(p);
    if (!pack) return 'no_pack';
    if (pack.credits_remaining <= 0) return 'no_credits';
    if (pack.credits_remaining <= 1) return 'low';
    if (pack.expires_at && new Date(pack.expires_at) < new Date(Date.now() + 7*86400000)) return 'expiring';
    return 'active';
  }

  const filtered = players.filter(p => {
    if (filter === 'all') return true;
    return getStatus(p) === filter;
  });

  const stats = {
    total:     players.length,
    active:    players.filter(p => getStatus(p) === 'active').length,
    low:       players.filter(p => ['low','no_credits'].includes(getStatus(p))).length,
    expiring:  players.filter(p => getStatus(p) === 'expiring').length,
    revenue:   players.reduce((sum, p) => {
      const pack = getActivePack(p);
      if (!pack) return sum;
      return sum + (pack.packs?.name === 'Discover' ? 120 : pack.packs?.name === 'Join 10' ? 400 : 0);
    }, 0),
  };

  const STATUS_CONFIG = {
    active:     { label: 'Active',      bg: '#E1F5EE', color: '#0F6E56' },
    low:        { label: 'Low credits', bg: '#FAEEDA', color: '#633806' },
    expiring:   { label: 'Expiring',    bg: '#FAEEDA', color: '#633806' },
    no_credits: { label: 'No credits',  bg: '#FCEBEB', color: '#A32D2D' },
    no_pack:    { label: 'No pack',     bg: '#F1EFE8', color: '#5F5E5A' },
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' }}>
      <div style={{ fontSize:13, color:'#888' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width:200, background:'#fafafa', borderRight:'0.5px solid #e8e8e8', padding:'20px 12px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24, paddingBottom:16, borderBottom:'0.5px solid #e8e8e8' }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'#1D9E75', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>DSG</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, lineHeight:1.3 }}>Tennis</div>
            <div style={{ fontSize:10, color:'#aaa' }}>Admin</div>
          </div>
        </div>
        {[{id:'players',l:'Players'},{id:'sessions',l:'Sessions'},{id:'revenue',l:'Revenue'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'8px 10px', borderRadius:8, border:'none', background: tab===t.id?'#fff':'transparent', fontSize:13, color: tab===t.id?'#0a0a0a':'#888', cursor:'pointer', marginBottom:2, fontWeight: tab===t.id?500:400, fontFamily:'inherit', textAlign:'left', boxShadow: tab===t.id?'0 1px 3px rgba(0,0,0,0.06)':'' }}>
            {t.l}
            {t.id==='players' && stats.low+stats.expiring > 0 && <span style={{ fontSize:10, background:'#E24B4A', color:'#fff', borderRadius:20, padding:'1px 6px', fontWeight:600 }}>{stats.low+stats.expiring}</span>}
          </button>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex:1, padding:24, overflow:'auto' }}>

        {tab === 'players' && (
          <>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:20 }}>
              {[
                { l:'Total players',   v: stats.total    },
                { l:'Active packs',    v: stats.active,  c:'good' },
                { l:'Need attention',  v: stats.low + stats.expiring, c: stats.low+stats.expiring>0?'warn':'' },
                { l:'Pack revenue',    v: '$'+stats.revenue.toLocaleString() },
              ].map(s => (
                <div key={s.l} style={{ background:'#f5f5f5', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>{s.l}</div>
                  <div style={{ fontSize:22, fontWeight:600, color: s.c==='good'?'#1D9E75':s.c==='warn'?'#BA7517':'#0a0a0a' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
              {['all','active','low','expiring','no_pack'].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ fontSize:12, padding:'4px 12px', borderRadius:20, border:'0.5px solid #e0e0e0', background: filter===f?'#f5f5f5':'transparent', color: filter===f?'#0a0a0a':'#888', cursor:'pointer', fontFamily:'inherit', fontWeight:filter===f?500:400 }}>
                  {f==='all'?'All':f==='no_pack'?'No pack':f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>

            {/* Table */}
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr>
                    {['Player','Pack','Credits','Sessions','Streak','Auto-renew','Status'].map(h=>(
                      <th key={h} style={{ textAlign:'left', fontSize:11, fontWeight:500, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.04em', padding:'0 10px 10px', borderBottom:'0.5px solid #e8e8e8', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const pack = getActivePack(p);
                    const status = getStatus(p);
                    const sc = STATUS_CONFIG[status];
                    return (
                      <tr key={p.id} style={{ borderBottom:'0.5px solid #f0f0f0' }}>
                        <td style={{ padding:'10px' }}>
                          <div style={{ fontWeight:500 }}>{p.full_name || 'Unknown'}</div>
                          <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>{p.email}</div>
                        </td>
                        <td style={{ padding:'10px' }}>
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#f5f5f5', color:'#888', fontWeight:500 }}>{pack?.packs?.name || '—'}</span>
                        </td>
                        <td style={{ padding:'10px' }}>
                          {pack ? (
                            <div>
                              <div style={{ fontSize:12, fontWeight:500 }}>{pack.credits_remaining} left</div>
                              <div style={{ fontSize:10, color:'#aaa' }}>{pack.credits_used}/{pack.credits_total} used</div>
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ padding:'10px', fontSize:13, color:'#0a0a0a' }}>{p.sessions_this_month || 0} this month</td>
                        <td style={{ padding:'10px' }}>
                          {(p.streak_weeks||0) > 0 ? <span style={{ fontSize:13 }}>🔥{p.streak_weeks}</span> : <span style={{ color:'#aaa' }}>—</span>}
                        </td>
                        <td style={{ padding:'10px' }}>
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500, background: pack?.auto_renew?'#E1F5EE':'#f5f5f5', color: pack?.auto_renew?'#0F6E56':'#aaa' }}>
                            {pack?.auto_renew ? 'On' : 'Off'}
                          </span>
                        </td>
                        <td style={{ padding:'10px' }}>
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500, background:sc.bg, color:sc.color }}>{sc.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ padding:'2rem', textAlign:'center', color:'#aaa', fontSize:13 }}>No players found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'sessions' && (
          <div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Sessions</div>
            <div style={{ fontSize:13, color:'#aaa' }}>Session management coming soon — will show live bookings per session, capacity, and waitlist.</div>
          </div>
        )}

        {tab === 'revenue' && (
          <div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Revenue</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {[
                { l:'Discover packs sold', v: players.filter(p=>getActivePack(p)?.packs?.name==='Discover').length, price: 120 },
                { l:'Join 10 packs sold',  v: players.filter(p=>getActivePack(p)?.packs?.name==='Join 10').length,  price: 400 },
              ].map(r => (
                <div key={r.l} style={{ background:'#f5f5f5', borderRadius:12, padding:'16px' }}>
                  <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>{r.l}</div>
                  <div style={{ fontSize:24, fontWeight:600 }}>{r.v}</div>
                  <div style={{ fontSize:13, color:'#1D9E75', marginTop:4 }}>${(r.v * r.price).toLocaleString()} revenue</div>
                </div>
              ))}
            </div>
            <div style={{ background:'#f5f5f5', borderRadius:12, padding:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:13, color:'#888' }}>Total pack revenue</div>
              <div style={{ fontSize:22, fontWeight:600 }}>${stats.revenue.toLocaleString()}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
