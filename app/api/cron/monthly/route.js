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

  const { error } = await supabase
    .from('players')
    .update({ sessions_this_month: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log('Monthly reset cron: sessions_this_month reset for all players');
  return NextResponse.json({ success: true });
}
