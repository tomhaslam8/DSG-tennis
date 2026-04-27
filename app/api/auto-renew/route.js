import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PACK_CONFIG = {
  discover: { credits: 3,  expiryDays: 21, name: 'Discover', priceId: 'price_1TOUF4CFcD2K4dxE8iBvYKal' },
  join10:   { credits: 12, expiryDays: 84, name: 'Join 10',  priceId: 'price_1TOUGACFcD2K4dxEIJgFmwM2' },
};

export async function POST(req) {
  try {
    const { userId, packId } = await req.json();
    if (!userId || !packId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const config = PACK_CONFIG[packId];
    if (!config) return NextResponse.json({ error: 'Invalid packId' }, { status: 400 });

    // Get player's Stripe customer and payment method
    const { data: player } = await supabase
      .from('players')
      .select('stripe_customer_id, stripe_payment_method_id, email')
      .eq('id', userId)
      .single();

    if (!player?.stripe_customer_id || !player?.stripe_payment_method_id) {
      console.log('No saved payment method for', userId);
      return NextResponse.json({ ok: false, reason: 'no_payment_method' });
    }

    // Check auto_renew is still on
    const { data: pack } = await supabase
      .from('player_packs')
      .select('auto_renew, credits_total, credits_used')
      .eq('player_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (!pack?.auto_renew) {
      return NextResponse.json({ ok: false, reason: 'auto_renew_off' });
    }

    // Check credits are actually at 0
    const creditsLeft = (pack.credits_total || 0) - (pack.credits_used || 0);
    if (creditsLeft > 0) {
      return NextResponse.json({ ok: false, reason: 'credits_remaining' });
    }

    // Charge the saved card off-session
    const paymentIntent = await stripe.paymentIntents.create({
      amount:               config.priceId === 'price_1TOUGACFcD2K4dxEIJgFmwM2' ? 40000 : 12000,
      currency:             'aud',
      customer:             player.stripe_customer_id,
      payment_method:       player.stripe_payment_method_id,
      confirm:              true,
      off_session:          true,
      metadata:             { userId, packId },
    });

    if (paymentIntent.status === 'succeeded') {
      // Get pack from packs table
      const { data: packRow } = await supabase
        .from('packs')
        .select('id')
        .eq('name', config.name)
        .single();

      if (!packRow) return NextResponse.json({ ok: false, reason: 'pack_not_found' });

      const expiresAt = config.expiryDays
        ? new Date(Date.now() + config.expiryDays * 86400000).toISOString()
        : null;

      // Mark current pack as completed
      await supabase.from('player_packs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('player_id', userId)
        .eq('status', 'active');

      // Create new pack
      await supabase.from('player_packs').insert({
        player_id:      userId,
        pack_id:        packRow.id,
        credits_total:  config.credits,
        credits_used:   0,
        social_credits: packId === 'discover' ? 1 : 0,
        status:         'active',
        auto_renew:     true,
        expires_at:     expiresAt,
        stripe_payment_intent_id: paymentIntent.id,
      });

      console.log('Auto-renewal successful for', userId);
      return NextResponse.json({ ok: true, renewed: true });

    } else {
      console.log('Payment failed for', userId, paymentIntent.status);
      return NextResponse.json({ ok: false, reason: 'payment_failed' });
    }

  } catch (err) {
    // Handle card errors (insufficient funds, declined etc)
    if (err.code === 'authentication_required' || err.type === 'StripeCardError') {
      console.log('Card error for auto-renewal:', err.message);
      return NextResponse.json({ ok: false, reason: 'card_error', message: err.message });
    }
    console.error('Auto-renewal error:', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
