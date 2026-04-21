'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const STEPS = [
  {
    key: 'name',
    question: "What should we call you?",
    sub: "Just your first name is fine.",
    type: 'text',
    placeholder: 'Your first name',
  },
  {
    key: 'skill_level',
    question: "What's your level?",
    sub: "Be honest — we'll match you to the right sessions.",
    type: 'choice',
    options: [
      { value: 'beginner',     label: 'Complete beginner', sub: 'Never played before' },
      { value: 'some',         label: 'Some experience',   sub: 'Played a few times' },
      { value: 'intermediate', label: 'Intermediate',      sub: 'Play regularly' },
      { value: 'advanced',     label: 'Advanced',          sub: 'Competitive player' },
    ],
  },
  {
    key: 'play_frequency',
    question: "How often do you want to play?",
    sub: "This sets your weekly goal and streak.",
    type: 'choice',
    options: [
      { value: '1', label: 'Once a week',       sub: 'Casual but consistent' },
      { value: '2', label: 'Twice a week',      sub: 'The sweet spot' },
      { value: '3', label: 'Three times a week', sub: 'Serious about it' },
    ],
  },
  {
    key: 'play_goal',
    question: "What's your main goal?",
    sub: "Choose as many as you like.",
    type: 'choice',
    options: [
      { value: 'fitness',   label: 'Get fit',        sub: 'Tennis as exercise' },
      { value: 'improve',   label: 'Improve my game', sub: 'Technique and skills' },
      { value: 'social',    label: 'Meet people',     sub: 'The social side' },
      { value: 'all',       label: 'All of the above', sub: 'The full package' },
    ],
  },
];

export default function Onboard() {
  const [step, setStep]     = useState(0);
  const [answers, setAnswers] = useState({ name:'', skill_level:'', play_frequency:'', play_goal:'' });
  const [loading, setLoading] = useState(false);
  const [user, setUser]     = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/login';
      else setUser(session.user);
    });
  }, []);

  function handleChoice(key, value) {
    setAnswers(a => ({ ...a, [key]: value }));
    if (step < STEPS.length - 1) setTimeout(() => setStep(s => s + 1), 300);
  }

  function handleText(e) {
    setAnswers(a => ({ ...a, name: e.target.value }));
  }

  async function handleSave() {
    if (!user) return;
    setLoading(true);
    await supabase.from('players').upsert({
      id:             user.id,
      email:          user.email,
      full_name:      answers.name.trim(),
      skill_level:    answers.skill_level,
      play_frequency: answers.play_frequency,
      play_goal:      answers.play_goal,
    }, { onConflict: 'id' });
    window.location.href = '/player';
  }

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;
  const canNext = answers[current.key] !== '';

  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'#f0f9f5',padding:'1rem'}}>
      <div style={{width:'100%',maxWidth:380,background:'#fff',borderRadius:24,padding:'2rem',border:'0.5px solid #e0e0e0'}}>

        {/* Progress dots */}
        <div style={{display:'flex',gap:6,marginBottom:28}}>
          {STEPS.map((_,i) => (
            <div key={i} style={{height:4,flex:1,borderRadius:2,background: i<=step ? '#1D9E75' : '#e8e8e8',transition:'background 0.3s'}} />
          ))}
        </div>

        <div style={{fontSize:11,color:'#aaa',marginBottom:4,letterSpacing:'0.05em',textTransform:'uppercase'}}>Discover Sports · Tennis</div>
        <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 6px',color:'#0a0a0a'}}>{current.question}</h1>
        <p style={{fontSize:13,color:'#888',margin:'0 0 24px',lineHeight:1.6}}>{current.sub}</p>

        {current.type === 'text' && (
          <>
            <input
              type="text"
              placeholder={current.placeholder}
              value={answers.name}
              onChange={handleText}
              onKeyDown={e => e.key==='Enter' && canNext && setStep(s=>s+1)}
              style={{width:'100%',padding:'12px 14px',borderRadius:12,border:'0.5px solid #ddd',fontSize:16,marginBottom:14,fontFamily:'inherit',outline:'none'}}
              autoFocus
            />
            <button
              onClick={() => setStep(s=>s+1)}
              disabled={!canNext}
              style={{width:'100%',padding:13,borderRadius:12,background:canNext?'#1D9E75':'#ccc',color:'#fff',border:'none',fontSize:14,fontWeight:600,cursor:canNext?'pointer':'default',fontFamily:'inherit'}}
            >
              Continue
            </button>
          </>
        )}

        {current.type === 'choice' && (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {current.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleChoice(current.key, opt.value)}
                style={{
                  padding:'14px 16px',
                  borderRadius:12,
                  border: answers[current.key]===opt.value ? '2px solid #1D9E75' : '0.5px solid #e0e0e0',
                  background: answers[current.key]===opt.value ? '#E1F5EE' : '#fff',
                  textAlign:'left',
                  cursor:'pointer',
                  fontFamily:'inherit',
                  transition:'all 0.15s',
                }}
              >
                <div style={{fontSize:14,fontWeight:600,color: answers[current.key]===opt.value?'#085041':'#0a0a0a'}}>{opt.label}</div>
                <div style={{fontSize:12,color: answers[current.key]===opt.value?'#0F6E56':'#aaa',marginTop:2}}>{opt.sub}</div>
              </button>
            ))}
          </div>
        )}

        {isLast && answers.play_goal && (
          <button
            onClick={handleSave}
            disabled={loading}
            style={{width:'100%',padding:13,borderRadius:12,background:loading?'#9FE1CB':'#1D9E75',color:'#fff',border:'none',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:16}}
          >
            {loading ? "Setting up your account..." : "Let's play →"}
          </button>
        )}

        {step > 0 && (
          <button
            onClick={() => setStep(s=>s-1)}
            style={{width:'100%',padding:10,borderRadius:12,background:'transparent',border:'none',fontSize:12,color:'#aaa',cursor:'pointer',fontFamily:'inherit',marginTop:8}}
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
