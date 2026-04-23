// GHL API utility for DSG Tennis
const GHL_BASE = 'https://services.leadconnectorhq.com';

async function ghlHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };
}

// Create or update a contact in GHL
export async function ghlUpsertContact({ email, firstName, phone, tags, customFields }) {
  try {
    const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: await ghlHeaders(),
      body: JSON.stringify({
        locationId: process.env.GHL_LOCATION_ID,
        email,
        firstName: firstName || email.split('@')[0],
        phone: phone || undefined,
        tags: tags || [],
        customFields: customFields ? Object.entries(customFields).map(([key, field_value]) => ({ key, field_value })) : [],
      }),
    });
    const data = await res.json();
    console.log('GHL upsert contact:', data?.contact?.id);
    return data?.contact?.id || null;
  } catch (e) {
    console.error('GHL upsert contact error:', e.message);
    return null;
  }
}

// Add tags to a contact (used to trigger GHL workflows)
export async function ghlAddTags({ contactId, tags }) {
  try {
    const res = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
      method: 'POST',
      headers: await ghlHeaders(),
      body: JSON.stringify({ tags }),
    });
    return res.ok;
  } catch (e) {
    console.error('GHL add tags error:', e.message);
    return false;
  }
}

// Update contact custom fields
export async function ghlUpdateContact({ contactId, customFields, tags }) {
  try {
    const body = {};
    if (customFields) body.customFields = Object.entries(customFields).map(([key, field_value]) => ({ key, field_value }));
    if (tags) body.tags = tags;
    const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
      method: 'PUT',
      headers: await ghlHeaders(),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error('GHL update contact error:', e.message);
    return false;
  }
}

// Find a contact by email
export async function ghlFindContact(email) {
  try {
    const res = await fetch(`${GHL_BASE}/contacts/search/duplicate?locationId=${process.env.GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`, {
      headers: await ghlHeaders(),
    });
    const data = await res.json();
    return data?.contact?.id || null;
  } catch (e) {
    console.error('GHL find contact error:', e.message);
    return null;
  }
}
