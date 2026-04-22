import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all players with active packs
  const { data: players, error } = await supabase
    .from('players')
    .select('id, streak_weeks');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  let updated = 0;
  let reset = 0;

  for (const player of players) {
    // Check if they had any confirmed booking in the past 7 days
    const { data: recentBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('player_id', player.id)
      .eq('status', 'confirmed')
      .gte('created_at', oneWeekAgo.toISOString())
      .limit(1);

    const playedThisWeek = recentBookings && recentBookings.length > 0;

    if (playedThisWeek) {
      await supabase
        .from('players')
        .update({ streak_weeks: (player.streak_weeks || 0) + 1 })
        .eq('id', player.id);
      updated++;
    } else {
      await supabase
        .from('players')
        .update({ streak_weeks: 0 })
        .eq('id', player.id);
      reset++;
    }
  }

  console.log(`Streak cron: ${updated} incremented, ${reset} reset`);
  return NextResponse.json({ success: true, updated, reset });
}
