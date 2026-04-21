import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PACK_PRICES = {
  discover: process.env.STRIPE_PRICE_DISCOVER || 'price_1TOUF4CFcD2K4dxE8iBvYKal',
  join10:   process.env.STRIPE_PRICE_JOIN10   || 'price_1TOUGACFcD2K4dxEIJgFmwM2',
};

export async function POST(req) {
  const { packId, userId, email } = await req.json();
  const priceId = PACK_PRICES[packId];
  if (!priceId) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId, packId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/player?success=true`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/purchase`,
    payment_intent_data: {
      setup_future_usage: 'off_session',
      metadata: { userId, packId },
    },
  });

  return NextResponse.json({ url: session.url });
}
