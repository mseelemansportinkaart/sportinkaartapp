import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientId(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: Request) {
  try {
    const clientId = getClientId(request);
    if (!checkRateLimit(clientId)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { type, formData } = body;

    // Validate request
    if (!type || !formData) {
      console.error('❌ Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let subject = '';
    let htmlContent = '';
    let textContent = '';

    if (type === 'add') {
      // Add Location Email
      const { locationName, sport, address, customerName, customerEmail } = formData;

      if (!locationName || !sport || !address || !customerName || !customerEmail) {
        return new Response(
          JSON.stringify({ error: 'Missing required form fields' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      subject = 'Nieuwe locatie toevoegen - Sportinkaart';

      const safeLocationName = escapeHtml(String(locationName));
      const safeSport = escapeHtml(String(sport));
      const safeAddress = escapeHtml(String(address));
      const safeCustomerName = escapeHtml(String(customerName));
      const safeCustomerEmail = escapeHtml(String(customerEmail));

      textContent = `Nieuwe locatie aanvraag:

Locatie Details:
- Naam locatie: ${locationName}
- Sport: ${sport}
- Adres: ${address}

Contactgegevens:
- Naam: ${customerName}
- E-mail: ${customerEmail}

---
Verzonden via Sportinkaart App`;

      htmlContent = `
        <h2>Nieuwe locatie aanvraag</h2>

        <h3>Locatie Details</h3>
        <ul>
          <li><strong>Naam locatie:</strong> ${safeLocationName}</li>
          <li><strong>Sport:</strong> ${safeSport}</li>
          <li><strong>Adres:</strong> ${safeAddress}</li>
        </ul>

        <h3>Contactgegevens</h3>
        <ul>
          <li><strong>Naam:</strong> ${safeCustomerName}</li>
          <li><strong>E-mail:</strong> ${safeCustomerEmail}</li>
        </ul>

        <hr>
        <p style="color: #666; font-size: 12px;">Verzonden via Sportinkaart App</p>
      `;
    } else if (type === 'change') {
      // Change Location Email
      const { existingLocation, changeInfo, customerName, customerEmail } = formData;

      if (!existingLocation || !changeInfo || !customerName || !customerEmail) {
        return new Response(
          JSON.stringify({ error: 'Missing required form fields' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      subject = 'Locatie informatie wijzigen - Sportinkaart';

      const safeExistingLocation = escapeHtml(String(existingLocation));
      const safeChangeInfo = escapeHtml(String(changeInfo));
      const safeCustomerName = escapeHtml(String(customerName));
      const safeCustomerEmail = escapeHtml(String(customerEmail));

      textContent = `Wijzigingsverzoek:

Wijzigingsdetails:
- Welke locatie: ${existingLocation}
- Wat moet er aangepast worden: ${changeInfo}

Contactgegevens:
- Naam: ${customerName}
- E-mail: ${customerEmail}

---
Verzonden via Sportinkaart App`;

      htmlContent = `
        <h2>Wijzigingsverzoek</h2>

        <h3>Wijzigingsdetails</h3>
        <ul>
          <li><strong>Welke locatie:</strong> ${safeExistingLocation}</li>
          <li><strong>Wat moet er aangepast worden:</strong> ${safeChangeInfo}</li>
        </ul>

        <h3>Contactgegevens</h3>
        <ul>
          <li><strong>Naam:</strong> ${safeCustomerName}</li>
          <li><strong>E-mail:</strong> ${safeCustomerEmail}</li>
        </ul>

        <hr>
        <p style="color: #666; font-size: 12px;">Verzonden via Sportinkaart App</p>
      `;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid form type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send email using Resend
    const data = await resend.emails.send({
      from: 'Sportinkaart <noreply@sportinkaart.nl>',
      to: ['info@sportinkaart.nl'],
      subject: subject,
      text: textContent,
      html: htmlContent,
      reply_to: formData.customerEmail || formData.changeCustomerEmail,
    });

    // Check if Resend returned an error
    if (data.error) {
      return new Response(
        JSON.stringify({
          error: 'Email service error',
          details: data.error.message || 'Failed to send email'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
