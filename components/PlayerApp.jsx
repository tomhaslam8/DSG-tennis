import { useState } from "react";

const INITIAL_CREDITS = 7;
const PACK_TOTAL = 12;

// ── Weekly schedule template ──────────────────────────────────
// credits: 1 = 1hr session, 1.5 = 90min session
// cap: confirmed capacities Apr 2026 — more space coming
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

// Generate sessions for a rolling 2-week window from today
function generateSessions() {
  const today = new Date("2026-04-28"); // demo anchor — replace with new Date() in production
  const sessions = [];
  let uid = 1;
  for (let week = 0; week < 2; week++) {
    WEEKLY_TEMPLATE.forEach(t => {
      const d = new Date(today);
      // find next occurrence of this weekday
      const daysAhead = (t.day - today.getDay() + 7 + week * 7) % (week === 0 ? 7 : 7) + (week * 7);
      d.setDate(today.getDate() + daysAhead);
      const dateStr = DAY_NAMES[t.day].slice(0,3) + " " + d.getDate() + " " + MONTHS[d.getMonth()];
      // demo booked counts — seeded so they look realistic
      const seed = t.id * 7 + week * 13;
      const booked = Math.floor((Math.sin(seed) * 0.5 + 0.5) * (t.cap * 0.7));
      sessions.push({
        id:      uid++,
        name:    t.name,
        level:   t.level,
        date:    dateStr,
        day:     DAY_NAMES[t.day],
        time:    t.time,
        end:     t.end,
        type:    t.type,
        credits: t.credits,
        spots:   t.cap - booked,
        cap:     t.cap,
      });
    });
  }
  return sessions;
}

const SESSIONS = generateSessions();

const INIT_PLAYERS = [
  { id:1, name:"Sarah K.",  pack:"Join 10",  credits:7,  total:12, autoRenew:true,  status:"active",   lastSeen:"Today",       sessions:5  },
  { id:2, name:"James M.",  pack:"Join 10",  credits:1,  total:12, autoRenew:true,  status:"low",      lastSeen:"Yesterday",   sessions:11 },
  { id:3, name:"Priya R.",  pack:"Discover", credits:2,  total:3,  autoRenew:false, status:"expiring", lastSeen:"5 days ago",  sessions:1  },
  { id:4, name:"Tom B.",    pack:"Join 10",  credits:12, total:12, autoRenew:true,  status:"active",   lastSeen:"Never",       sessions:0  },
  { id:5, name:"Nina W.",   pack:"Discover", credits:0,  total:3,  autoRenew:false, status:"done",     lastSeen:"8 days ago",  sessions:3  },
  { id:6, name:"Marcus L.", pack:"Join 10",  credits:4,  total:12, autoRenew:true,  status:"active",   lastSeen:"Today",       sessions:8  },
];

export default function App() {
  const [mode, setMode]         = useState("player");
  const [pview, setPview]       = useState("home");
  const [selected, setSelected] = useState(null);
  const [credits, setCredits]   = useState(INITIAL_CREDITS);
  const [autoRenew, setAutoRenew] = useState(true);
  const [players, setPlayers]   = useState(INIT_PLAYERS);
  const [bookings, setBookings] = useState([
    { id:1, name:"Ladies social",   date:"Sat 26 Apr", time:"9:00am", status:"upcoming" },
    { id:2, name:"Beginner clinic", date:"Tue 22 Apr", time:"6:00pm", status:"attended" },
  ]);
  const [adminTab, setAdminTab] = useState("players");
  const [filter, setFilter]     = useState("all");

  const used = PACK_TOTAL - credits;

  function doBook(s) {
    setSelected(s);
    setPview("confirm");
  }

  function doConfirm() {
    const newCreds = Math.round((credits - selected.credits) * 10) / 10;
    setCredits(newCreds);
    setBookings(b => [{ id: Date.now(), name: selected.name, date: selected.date, time: selected.time, status: "upcoming" }, ...b]);
    setPlayers(ps => ps.map(p => p.id === 1 ? { ...p, credits: newCreds, sessions: p.sessions + 1, status: newCreds <= 2 ? "low" : "active" } : p));
    setPview("success");
  }

  const filteredPlayers = players.filter(p => filter === "all" || p.status === filter);
  const stats = {
    active:    players.filter(p => ["active","low"].includes(p.status)).length,
    low:       players.filter(p => p.status === "low").length,
    expiring:  players.filter(p => p.status === "expiring").length,
    autoRenew: players.filter(p => p.autoRenew).length,
  };

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: "var(--color-text-primary)", padding: "1rem 0" }}>

      {/* Toggle */}
      <div style={{ display:"flex", gap:8, marginBottom:"1.25rem", justifyContent:"center" }}>
        {["player","admin"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding:"7px 20px", borderRadius:20, border:"0.5px solid var(--color-border-secondary)", background: mode===m ? "var(--color-background-secondary)" : "transparent", color: mode===m ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: mode===m ? 500 : 400, cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>
            {m === "player" ? "Player app" : "Admin dashboard"}
          </button>
        ))}
      </div>

      {/* ── PLAYER VIEW ────────────────────────────────────── */}
      {mode === "player" && (
        <div style={{ display:"flex", justifyContent:"center" }}>
          <div style={{ width:340, background:"var(--color-background-primary)", borderRadius:32, border:"0.5px solid var(--color-border-secondary)", overflow:"hidden", boxShadow:"0 2px 20px rgba(0,0,0,0.06)" }}>
            {/* Status bar */}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"14px 20px 8px", fontSize:11 }}>
              <span style={{ fontWeight:600 }}>9:41</span>
              <span style={{ color:"var(--color-text-tertiary)", letterSpacing:"0.03em" }}>Discover Sports · Tennis</span>
            </div>

            {/* Screen */}
            <div style={{ padding:"0 16px", minHeight:540, maxHeight:540, overflowY:"auto" }}>

              {pview === "home" && (
                <div style={{ paddingBottom:16 }}>
                  <div style={{ padding:"12px 0 14px" }}>
                    <div style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>Good morning</div>
                    <div style={{ fontSize:22, fontWeight:600, lineHeight:1.2, marginTop:2 }}>Sarah</div>
                  </div>

                  {/* Pack card */}
                  <div style={{ background:"#E1F5EE", borderRadius:16, padding:14, marginBottom:10 }}>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#085041" }}>Join 10</div>
                      <div style={{ fontSize:11, color:"#0F6E56", marginTop:2 }}>{credits} credit{credits!==1?"s":""} remaining</div>
                    </div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                      {Array.from({length: PACK_TOTAL}).map((_,i) => (
                        <div key={i} style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, background: i<used ? "#9FE1CB" : "#fff", color: i<used ? "#085041" : "#0F6E56", border: i<used ? "none" : "1.5px solid #5DCAA5", transition:"all 0.3s" }}>
                          {i < used ? "✓" : i+1}
                        </div>
                      ))}
                    </div>
                    <div style={{ height:4, background:"#9FE1CB", borderRadius:2, marginBottom:4 }}>
                      <div style={{ height:4, background:"#0F6E56", borderRadius:2, width:`${(used/PACK_TOTAL)*100}%`, transition:"width 0.4s ease" }} />
                    </div>
                    <div style={{ fontSize:10, color:"#0F6E56" }}>{used} of {PACK_TOTAL} used</div>
                  </div>

                  {credits <= 2 && credits > 0 && (
                    <div style={{ background:"#FAEEDA", borderRadius:12, padding:"10px 12px", marginBottom:10, fontSize:12, color:"#633806" }}>
                      <div style={{ fontWeight:500 }}>Only {credits} credit{credits!==1?"s":""} left</div>
                      <div style={{ fontSize:11, marginTop:2 }}>Top up to keep playing</div>
                    </div>
                  )}

                  <button onClick={() => setPview("book")} style={{ width:"100%", padding:12, borderRadius:12, background:"#1D9E75", color:"#E1F5EE", border:"none", fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:8 }}>
                    Book a session
                  </button>

                  <div style={{ fontSize:10, fontWeight:600, color:"var(--color-text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em", margin:"14px 0 8px" }}>Coming up</div>
                  {bookings.filter(b=>b.status==="upcoming").slice(0,2).map(b => (
                    <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10, background:"var(--color-background-secondary)", borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:"#1D9E75", flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:500 }}>{b.name}</div>
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:1 }}>{b.date} · {b.time}</div>
                      </div>
                      <div style={{ fontSize:11, color:"#0F6E56", fontWeight:500 }}>Booked</div>
                    </div>
                  ))}
                </div>
              )}

              {pview === "book" && (
                <div style={{ paddingBottom:16 }}>
                  <div style={{ paddingTop:14, paddingBottom:12 }}>
                    <button onClick={() => setPview("home")} style={{ background:"none", border:"none", color:"var(--color-text-secondary)", fontSize:12, cursor:"pointer", padding:0, marginBottom:4, fontFamily:"inherit" }}>← Back</button>
                    <div style={{ fontSize:16, fontWeight:600 }}>Book a session</div>
                  </div>
                  <div style={{ display:"inline-block", fontSize:11, padding:"2px 10px", borderRadius:20, background:"#E1F5EE", color:"#0F6E56", fontWeight:500, marginBottom:14 }}>{credits} credit{credits!==1?"s":""} available</div>
                  {(() => {
                    // Group sessions by day
                    const days = [];
                    const seen = {};
                    SESSIONS.forEach(s => { if (!seen[s.day]) { seen[s.day] = true; days.push(s.day); } });
                    return days.map(day => (
                      <div key={day} style={{ marginBottom:14 }}>
                        <div style={{ fontSize:10, fontWeight:600, color:"var(--color-text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
                          {SESSIONS.find(s=>s.day===day).date}
                        </div>
                        {SESSIONS.filter(s=>s.day===day).map(s => {
                          const canAfford = credits >= s.credits;
                          const available = s.spots > 0 && canAfford;
                          const creditLabel = s.credits === 1 ? "1 credit" : "1.5 credits";
                          const creditBg  = s.credits === 1 ? "#E1F5EE" : "#EEEDFE";
                          const creditCol = s.credits === 1 ? "#0F6E56" : "#3C3489";
                          const typeCol   = s.type === "social" ? "#534AB7" : "#0F6E56";
                          return (
                            <button key={s.id} onClick={() => available && doBook(s)} disabled={!available} style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"flex-start", background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, padding:"10px 12px", marginBottom:6, cursor:available?"pointer":"default", textAlign:"left", opacity:(!available)?0.45:1, fontFamily:"inherit" }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, fontWeight:500 }}>{s.name}</div>
                                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{s.time}–{s.end} &nbsp;·&nbsp; <span style={{ color:typeCol }}>{s.level}</span></div>
                                <div style={{ fontSize:11, marginTop:3, color: s.spots===0?"#A32D2D":!canAfford?"#854F0B":"#0F6E56", fontWeight:500 }}>
                                  {s.spots===0 ? "Full — join waitlist" : !canAfford ? "Not enough credits" : `${s.spots} spot${s.spots!==1?"s":""} left`}
                                </div>
                              </div>
                              <div style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:creditBg, color:creditCol, fontWeight:500, whiteSpace:"nowrap", flexShrink:0, marginLeft:8, marginTop:2 }}>{creditLabel}</div>
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              )}

              {pview === "confirm" && selected && (
                <div style={{ paddingBottom:16 }}>
                  <div style={{ paddingTop:14, paddingBottom:12 }}>
                    <button onClick={() => setPview("book")} style={{ background:"none", border:"none", color:"var(--color-text-secondary)", fontSize:12, cursor:"pointer", padding:0, marginBottom:4, fontFamily:"inherit" }}>← Back</button>
                    <div style={{ fontSize:16, fontWeight:600 }}>Confirm booking</div>
                  </div>
                  <div style={{ background:"var(--color-background-secondary)", borderRadius:12, padding:14, marginBottom:14 }}>
                    {[["Session",selected.name],["Level",selected.level],["Date",selected.date],["Time",selected.time + " – " + selected.end]].map(([k,v])=>(
                      <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"4px 0" }}>
                        <span style={{ color:"var(--color-text-secondary)" }}>{k}</span>
                        <span style={{ fontWeight:500 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ borderTop:"0.5px solid var(--color-border-tertiary)", margin:"8px 0" }} />
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"4px 0" }}>
                      <span style={{ color:"var(--color-text-secondary)" }}>Cost</span>
                      <span style={{ color:"#0F6E56", fontWeight:600 }}>{selected.credits} credit{selected.credits!==1?"s":""}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"4px 0" }}>
                      <span style={{ color:"var(--color-text-secondary)" }}>Credits after</span>
                      <span style={{ fontWeight:500 }}>{(credits - selected.credits).toFixed(1).replace(".0","")} remaining</span>
                    </div>
                  </div>
                  <button onClick={doConfirm} style={{ width:"100%", padding:12, borderRadius:12, background:"#1D9E75", color:"#E1F5EE", border:"none", fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:8 }}>Confirm booking</button>
                  <button onClick={() => setPview("book")} style={{ width:"100%", padding:12, borderRadius:12, background:"transparent", border:"0.5px solid var(--color-border-secondary)", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Choose different session</button>
                </div>
              )}

              {pview === "success" && selected && (
                <div style={{ paddingBottom:16, textAlign:"center", paddingTop:"1.5rem" }}>
                  <div style={{ width:56, height:56, borderRadius:"50%", background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontSize:18, fontWeight:600, marginBottom:6 }}>You're booked in</div>
                  <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:20 }}>{selected.name} · {selected.date} · {selected.time}</div>
                  <div style={{ background:"var(--color-background-secondary)", borderRadius:12, padding:14, marginBottom:14, textAlign:"left" }}>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:8, fontWeight:500 }}>Credits remaining</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {Array.from({length: PACK_TOTAL}).map((_,i)=>(
                        <div key={i} style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:600, background: i < (PACK_TOTAL-credits) ? "#9FE1CB" : "#fff", color: i < (PACK_TOTAL-credits) ? "#085041" : "#0F6E56", border: i < (PACK_TOTAL-credits) ? "none" : "1.5px solid #5DCAA5" }}>
                          {i < (PACK_TOTAL-credits) ? "✓" : i+1}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:8 }}>Confirmation sent to your email</div>
                  </div>
                  <button onClick={() => setPview("book")} style={{ width:"100%", padding:12, borderRadius:12, background:"#1D9E75", color:"#E1F5EE", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:8 }}>Book another session</button>
                  <button onClick={() => setPview("home")} style={{ width:"100%", padding:12, borderRadius:12, background:"transparent", border:"0.5px solid var(--color-border-secondary)", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Back to home</button>
                </div>
              )}
            </div>

            {/* Bottom nav */}
            <div style={{ display:"flex", borderTop:"0.5px solid var(--color-border-tertiary)", padding:"8px 0 18px", background:"var(--color-background-primary)" }}>
              {[{id:"home",l:"Home"},{id:"book",l:"Book"},{id:"history",l:"History"},{id:"settings",l:"Account"}].map(n=>(
                <button key={n.id} onClick={() => { if(n.id==="history") setPview("home"); else if(n.id==="settings") setPview("home"); else setPview(n.id); }} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:"none", border:"none", cursor:"pointer", padding:"4px 0" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background: (pview===n.id||(n.id==="home"&&!["book","confirm","success"].includes(pview))) ? "#1D9E75" : "transparent", marginBottom:1 }} />
                  <span style={{ fontSize:10, color: (pview===n.id||(n.id==="home"&&!["book","confirm","success"].includes(pview))) ? "#1D9E75" : "var(--color-text-tertiary)" }}>{n.l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN VIEW ─────────────────────────────────────── */}
      {mode === "admin" && (
        <div style={{ border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", overflow:"hidden", display:"flex", minHeight:560 }}>
          {/* Sidebar */}
          <div style={{ width:160, background:"var(--color-background-secondary)", borderRight:"0.5px solid var(--color-border-tertiary)", padding:"16px 10px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, paddingBottom:14, borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ width:28, height:28, borderRadius:7, background:"#1D9E75", color:"#E1F5EE", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>DSG</div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, lineHeight:1.3 }}>Tennis</div>
                <div style={{ fontSize:10, color:"var(--color-text-tertiary)" }}>Admin</div>
              </div>
            </div>
            {[{id:"players",l:"Players"},{id:"sessions",l:"Sessions"},{id:"revenue",l:"Revenue"}].map(t=>(
              <button key={t.id} onClick={()=>setAdminTab(t.id)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"7px 8px", borderRadius:8, border:"none", background: adminTab===t.id?"var(--color-background-primary)":"transparent", fontSize:13, color: adminTab===t.id?"var(--color-text-primary)":"var(--color-text-secondary)", cursor:"pointer", marginBottom:2, fontWeight: adminTab===t.id?500:400, fontFamily:"inherit", textAlign:"left" }}>
                {t.l}
                {t.id==="players" && (stats.low+stats.expiring) > 0 && <span style={{ fontSize:10, background:"#E24B4A", color:"#fff", borderRadius:20, padding:"1px 5px", fontWeight:600 }}>{stats.low+stats.expiring}</span>}
              </button>
            ))}
          </div>

          {/* Main */}
          <div style={{ flex:1, padding:16, overflow:"auto" }}>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:8, marginBottom:16 }}>
              {adminTab==="players" && <>
                <Stat l="Active"      v={stats.active}    />
                <Stat l="Low credits" v={stats.low}       c="warn" />
                <Stat l="Expiring"    v={stats.expiring}  c="warn" />
                <Stat l="Auto-renew"  v={stats.autoRenew} c="good" />
              </>}
              {adminTab==="sessions" && <>
                <Stat l="Sessions today" v={2} />
                <Stat l="Booked"         v={14} />
                <Stat l="Available"      v={2} c="good" />
                <Stat l="Courts"         v={3} />
              </>}
              {adminTab==="revenue" && <>
                <Stat l="Apr revenue"   v={"$"+((players.filter(p=>p.pack==="Discover").length*120)+(players.filter(p=>p.pack==="Join 10").length*400)).toLocaleString()} />
                <Stat l="Discover packs" v={players.filter(p=>p.pack==="Discover").length} />
                <Stat l="Join 10 packs" v={players.filter(p=>p.pack==="Join 10").length} />
                <Stat l="Auto-renew"    v={stats.autoRenew} c="good" />
              </>}
            </div>

            {adminTab === "players" && (
              <>
                <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
                  {["all","active","low","expiring","done"].map(f=>(
                    <button key={f} onClick={()=>setFilter(f)} style={{ fontSize:11, padding:"3px 10px", borderRadius:20, border:"0.5px solid var(--color-border-secondary)", background: filter===f?"var(--color-background-secondary)":"transparent", color: filter===f?"var(--color-text-primary)":"var(--color-text-secondary)", cursor:"pointer", fontWeight:filter===f?500:400, fontFamily:"inherit" }}>
                      {f.charAt(0).toUpperCase()+f.slice(1)}
                    </button>
                  ))}
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr>
                      {["Player","Pack","Credits","Auto-renew","Sessions","Status"].map(h=>(
                        <th key={h} style={{ textAlign:"left", fontSize:10, fontWeight:500, color:"var(--color-text-tertiary)", textTransform:"uppercase", letterSpacing:"0.04em", padding:"0 8px 8px", borderBottom:"0.5px solid var(--color-border-tertiary)", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map(p=>(
                      <tr key={p.id} style={{ borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                        <td style={{ padding:"9px 8px" }}>
                          <div style={{ fontWeight:500, fontSize:12 }}>{p.name}</div>
                          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:1 }}>Joined {p.joined}</div>
                        </td>
                        <td style={{ padding:"9px 8px" }}>
                          <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:"var(--color-background-secondary)", color:"var(--color-text-secondary)", fontWeight:500 }}>{p.pack}</span>
                        </td>
                        <td style={{ padding:"9px 8px" }}>
                          <div style={{ display:"flex", gap:2, flexWrap:"wrap", maxWidth:70 }}>
                            {Array.from({length:Math.min(p.total,12)}).map((_,i)=>(
                              <div key={i} style={{ width:6, height:6, borderRadius:"50%", background: i<(p.total-p.credits)?"#9FE1CB":"#1D9E75" }} />
                            ))}
                          </div>
                          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:2 }}>{p.credits} left</div>
                        </td>
                        <td style={{ padding:"9px 8px" }}>
                          <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:500, background:p.autoRenew?"#E1F5EE":"var(--color-background-secondary)", color:p.autoRenew?"#0F6E56":"var(--color-text-tertiary)" }}>
                            {p.autoRenew?"On":"Off"}
                          </span>
                        </td>
                        <td style={{ padding:"9px 8px", fontSize:12, color:"var(--color-text-secondary)" }}>{p.sessions}</td>
                        <td style={{ padding:"9px 8px" }}>
                          <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:500,
                            background: p.status==="active"?"#E1F5EE":p.status==="low"?"#FAEEDA":p.status==="expiring"?"#FAEEDA":"var(--color-background-secondary)",
                            color: p.status==="active"?"#0F6E56":p.status==="low"?"#633806":p.status==="expiring"?"#633806":"var(--color-text-tertiary)"
                          }}>
                            {p.status.charAt(0).toUpperCase()+p.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {adminTab === "sessions" && (
              <div>
                <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-tertiary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12 }}>Today's sessions</div>
                {[
                  { name:"Beginner clinic", time:"6:00pm", court:"Court 2", booked:6, cap:8 },
                  { name:"Evening social",  time:"7:30pm", court:"Court 1", booked:8, cap:8 },
                ].map((sess,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{sess.name}</div>
                      <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{sess.time} · {sess.court}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ width:80, height:4, background:"var(--color-border-tertiary)", borderRadius:2, marginBottom:4 }}>
                        <div style={{ height:4, borderRadius:2, background: sess.booked/sess.cap>=1?"#E24B4A":sess.booked/sess.cap>=0.75?"#BA7517":"#1D9E75", width:`${(sess.booked/sess.cap)*100}%` }} />
                      </div>
                      <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{sess.booked}/{sess.cap}</div>
                    </div>
                  </div>
                ))}
                <button style={{ marginTop:14, fontSize:12, padding:"7px 14px", borderRadius:8, border:"0.5px solid var(--color-border-secondary)", background:"transparent", cursor:"pointer", fontFamily:"inherit" }}>+ Add session</button>
              </div>
            )}

            {adminTab === "revenue" && (
              <div>
                {[
                  { name:"Discover pack", count:players.filter(p=>p.pack==="Discover").length, price:120 },
                  { name:"Join 10 pack",  count:players.filter(p=>p.pack==="Join 10").length,  price:400 },
                ].map(r=>(
                  <div key={r.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{r.count} active players · ${r.price} each</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:18, fontWeight:500 }}>${(r.count*r.price).toLocaleString()}</div>
                      <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>this month</div>
                    </div>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"14px 0" }}>
                  <span style={{ fontSize:13, color:"var(--color-text-secondary)" }}>Total this month</span>
                  <span style={{ fontSize:20, fontWeight:600 }}>${((players.filter(p=>p.pack==="Discover").length*120)+(players.filter(p=>p.pack==="Join 10").length*400)).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ l, v, c }) {
  return (
    <div style={{ background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", padding:"10px 12px" }}>
      <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3 }}>{l}</div>
      <div style={{ fontSize:20, fontWeight:500, color: c==="good"?"var(--color-text-success)":c==="warn"?"var(--color-text-warning)":"var(--color-text-primary)" }}>{v}</div>
    </div>
  );
}
