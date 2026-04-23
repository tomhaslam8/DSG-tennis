import { NextResponse } from 'next/server';
import { ghlFindContact, ghlAddTags, ghlUpdateContact, ghlUpsertContact } from '../../../lib/ghl';

export async function POST(req) {
  try {
    const { trigger, event, email, firstName, data } = await req.json();
    const eventType = trigger || event;

    if (!email) return NextResponse.json({ ok: false, reason: 'no email' });

    // Find or create the contact
    let contactId = await ghlFindContact(email);
    if (!contactId) {
      contactId = await ghlUpsertContact({ email, firstName: firstName || email.split('@')[0] });
    }
    if (!contactId) return NextResponse.json({ ok: false, reason: 'contact not found' });

    // Map event types to GHL tags (these tags trigger workflows in GHL)
    const tagMap = {
      'booking_confirmation': ['booking-confirmed'],
      'low_credits_3':        ['low-credits-3'],
      'low_credits_1':        ['low-credits-1'],
      'discover_complete':    ['discover-complete'],
      'rain_cancelled':       ['session-rain-cancelled'],
    };

    const tags = tagMap[eventType];
    if (!tags) return NextResponse.json({ ok: false, reason: 'unknown event' });

    // Update custom fields based on event
    const customFields = {};
    if (data?.sessionName)     customFields.last_session_name      = data.sessionName;
    if (data?.sessionDate)     customFields.last_session_date      = data.sessionDate;
    if (data?.sessionTime)     customFields.last_session_time      = data.sessionTime;
    if (data?.creditsRemaining !== undefined) customFields.credits_remaining = String(data.creditsRemaining);
    if (data?.cancelledSession) customFields.cancelled_session      = data.cancelledSession;

    await ghlUpdateContact({ contactId, customFields, tags });

    console.log(`GHL event '${eventType}' fired for ${email}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('GHL event error:', e.message);
    return NextResponse.json({ ok: false, error: e.message });
  }
}
