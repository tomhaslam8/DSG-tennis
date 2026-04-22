'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function PlayerPage() {
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);
      const { data } = await supabase
        .from('players')
        .select('full_name, play_frequency, skill_level, play_goal, streak_weeks, total_sessions, sessions_this_month, created_at')
        .eq('id', session.user.id)
        .single();
      if (!data || !data.full_name) {
        window.location.href = '/onboard';
        return;
      }
      setPlayerName(data.full_name);
      setPlayerData(data);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' }}>
      <div style={{ fontSize:13, color:'#888' }}>Loading...</div>
    </div>
  );

  const PlayerApp = require('../../components/PlayerApp').default;
  return <PlayerApp user={user} playerName={playerName} playerData={playerData} />;
}
