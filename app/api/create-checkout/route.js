import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PACK_PRICES = {
  discover: process.env.STRIPE_PRICE_DISCOVER || 'price_1TOUF4CFcD2K4dxE8iBvYKal',
  join10:   process.env.STRIPE_PRICE_JOIN10   || 'price_1TOUGACFcD2K4dxEIJgFmwM2',
};

export async function POST(req) {
  const { packId, userId, email } = await req.json();
  const priceId = PACK_PRICES[packId];
  if (!priceId) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });

  // Get or create Stripe customer so we can charge them later for auto-renewal
  let stripeCustomerId = null;
  try {
    const { data: player } = await supabase
      .from('players')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (player?.stripe_customer_id) {
      stripeCustomerId = player.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      // Save to DB immediately
      await supabase.from('players').update({ stripe_customer_id: stripeCustomerId }).eq('id', userId);
    }
  } catch (e) {
    console.error('Stripe customer creation error:', e.message);
  }

  // Calculate Stripe processing fee to pass to customer (1.75% + 30c AU domestic)
  const baseAmount = packId === 'join10' ? 40000 : 12000;
  const stripeFee = Math.round(baseAmount * 0.0175 + 30);

  const sessionParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      { price: priceId, quantity: 1 },
      {
        price_data: {
          currency: 'aud',
          unit_amount: stripeFee,
          product_data: { name: 'Processing fee' },
        },
        quantity: 1,
      },
    ],
    metadata: { userId, packId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/welcome?email=${encodeURIComponent('{CHECKOUT_SESSION.customer_email}')}&pack=${packId}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/purchase`,
    payment_intent_data: {
      setup_future_usage: 'off_session',
      metadata: { userId, packId },
    },
  };

  // Attach customer if we have one
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
    delete sessionParams.customer_email;
  } else {
    sessionParams.customer_email = email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return NextResponse.json({ url: session.url });
}
