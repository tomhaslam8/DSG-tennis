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

  const { data: players, error } = await supabase
    .from('players')
    .select('id, streak_weeks, play_frequency');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  let updated = 0;
  let reset = 0;

  for (const player of players) {
    const weeklyGoal = parseInt(player.play_frequency) || 1;

    // Count confirmed bookings in past 7 days
    const { data: recentBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('player_id', player.id)
      .eq('status', 'confirmed')
      .gte('created_at', oneWeekAgo.toISOString());

    const bookingsThisWeek = recentBookings?.length || 0;
    const hitGoal = bookingsThisWeek >= weeklyGoal;

    if (hitGoal) {
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

  console.log(`Streak cron: ${updated} incremented (hit goal), ${reset} reset`);
  return NextResponse.json({ success: true, updated, reset });
}
