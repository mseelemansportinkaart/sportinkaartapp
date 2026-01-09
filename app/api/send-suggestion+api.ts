import { Resend } from 'resend';

const resend = new Resend(process.env.EXPO_PUBLIC_RESEND_API_KEY);

export async function POST(request: Request) {
  console.log('🚀 API Route hit: /api/send-suggestion');
  console.log('🔑 API Key present:', !!process.env.EXPO_PUBLIC_RESEND_API_KEY);
  console.log('🔑 API Key value:', process.env.EXPO_PUBLIC_RESEND_API_KEY?.substring(0, 10) + '...');

  try {
    const body = await request.json();
    console.log('📦 Request body:', JSON.stringify(body, null, 2));
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
          <li><strong>Naam locatie:</strong> ${locationName}</li>
          <li><strong>Sport:</strong> ${sport}</li>
          <li><strong>Adres:</strong> ${address}</li>
        </ul>

        <h3>Contactgegevens</h3>
        <ul>
          <li><strong>Naam:</strong> ${customerName}</li>
          <li><strong>E-mail:</strong> ${customerEmail}</li>
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
          <li><strong>Welke locatie:</strong> ${existingLocation}</li>
          <li><strong>Wat moet er aangepast worden:</strong> ${changeInfo}</li>
        </ul>

        <h3>Contactgegevens</h3>
        <ul>
          <li><strong>Naam:</strong> ${customerName}</li>
          <li><strong>E-mail:</strong> ${customerEmail}</li>
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
    console.log('📧 Attempting to send email via Resend...');
    console.log('📧 To:', 'info@sportinkaart.nl');
    console.log('📧 Subject:', subject);

    const data = await resend.emails.send({
      from: 'Sportinkaart <noreply@sportinkaart.nl>',
      to: ['info@sportinkaart.nl'],
      subject: subject,
      text: textContent,
      html: htmlContent,
      reply_to: formData.customerEmail || formData.changeCustomerEmail,
    });

    console.log('📬 Resend response:', JSON.stringify(data, null, 2));

    // Check if Resend returned an error
    if (data.error) {
      console.error('❌ Resend API error:', data.error);
      return new Response(
        JSON.stringify({
          error: 'Email service error',
          details: data.error.message || 'Failed to send email'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Email sent successfully!');

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in API route:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
