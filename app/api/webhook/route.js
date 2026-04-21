import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PACK_CONFIG = {
  discover: { credits: 3,  expiryDays: 21 },
  join10:   { credits: 12, expiryDays: null },
};

export async function POST(req) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, packId } = session.metadata;
    const config = PACK_CONFIG[packId];
    if (!config || !userId) return NextResponse.json({ received: true });

    const { data: packRow } = await supabase
      .from('packs')
      .select('id')
      .eq('name', packId === 'discover' ? 'Discover' : 'Join 10')
      .single();

    const expiresAt = config.expiryDays
      ? new Date(Date.now() + config.expiryDays * 86400000).toISOString()
      : null;

    await supabase.from('player_packs').insert({
      player_id:     userId,
      pack_id:       packRow.id,
      credits_total: config.credits,
      credits_used:  0,
      status:        'active',
      auto_renew:    true,
      expires_at:    expiresAt,
    });

    await supabase.from('players').upsert({
      id:    userId,
      email: session.customer_email,
      full_name: session.customer_email.split('@')[0],
    }, { onConflict: 'id' });
  }

  return NextResponse.json({ received: true });
}
