import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { ghlUpsertContact } from '../../../lib/ghl';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PACK_CONFIG = {
  discover: { credits: 3,  expiryDays: 21, name: 'Discover', socialCredits: 1 },
  join10:   { credits: 12, expiryDays: 84, name: 'Join 10',  socialCredits: 0 },
};

export async function POST(req) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, packId } = session.metadata || {};
    const config = PACK_CONFIG[packId];

    console.log('Webhook received:', { userId, packId, email: session.customer_email });

    if (!config || !userId) {
      console.error('Missing config or userId', { userId, packId });
      return NextResponse.json({ received: true });
    }

    // Get payment intent to find payment method for future charges
    let stripePaymentMethodId = null;
    let stripeCustomerId = session.customer || null;
    try {
      if (session.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
        stripePaymentMethodId = pi.payment_method;
        if (!stripeCustomerId) stripeCustomerId = pi.customer;
      }
    } catch (e) {
      console.error('Failed to retrieve payment intent:', e.message);
    }

    // Upsert player - save stripe customer ID and payment method
    const { error: playerError } = await supabase.from('players').upsert({
      id:                      userId,
      email:                   session.customer_email || '',
      full_name:               (session.customer_email || '').split('@')[0],
      stripe_customer_id:      stripeCustomerId,
      stripe_payment_method_id: stripePaymentMethodId,
    }, { onConflict: 'id' });

    if (playerError) console.error('Player upsert error:', playerError);

    // Get pack from packs table
    const { data: packRow, error: packError } = await supabase
      .from('packs')
      .select('id')
      .eq('name', config.name)
      .single();

    if (packError || !packRow) {
      console.error('Pack not found:', config.name, packError);
      return NextResponse.json({ received: true });
    }

    const expiresAt = config.expiryDays
      ? new Date(Date.now() + config.expiryDays * 86400000).toISOString()
      : null;

    // Check for existing active pack to carry over remaining credits
    const { data: existingPack } = await supabase
      .from('player_packs')
      .select('id, credits_total, credits_used')
      .eq('player_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const carryOver = existingPack
      ? Math.max(0, existingPack.credits_total - existingPack.credits_used)
      : 0;

    // Mark existing active pack as completed
    if (existingPack) {
      await supabase.from('player_packs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', existingPack.id);
    }

    const { error: packInsertError } = await supabase.from('player_packs').insert({
      player_id:      userId,
      pack_id:        packRow.id,
      credits_total:  config.credits + carryOver,
      credits_used:   0,
      social_credits: config.socialCredits,
      status:         'active',
      auto_renew:     true,
      expires_at:     expiresAt,
    });

    if (packInsertError) {
      console.error('Pack insert error:', packInsertError);
    } else {
      console.log('Pack created for', userId, 'carry over:', carryOver);

      // Create GHL contact
      await ghlUpsertContact({
        email:        session.customer_email || '',
        firstName:    (session.customer_email || '').split('@')[0],
        tags:         ['dsg-tennis', config.name === 'Discover' ? 'discover-purchased' : 'join10-purchased'],
        customFields: {
          pack_type:         config.name,
          credits_total:     String(config.credits + carryOver),
          pack_purchased_at: new Date().toISOString().split('T')[0],
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
