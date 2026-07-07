import { Resend } from 'resend';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.matterhillgarten.ch',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  // Set CORS headers on all responses
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vorname, nachname, email, telefon, leistung, nachricht, website } = req.body || {};

  // Honeypot spam protection — if the hidden field has a value, it's a bot
  if (website) {
    return res.status(200).json({ success: true });
  }

  // Validate required fields
  if (!vorname || !nachname || !email || !nachricht) {
    return res.status(400).json({
      error: 'Bitte füllen Sie alle Pflichtfelder aus (Vorname, Nachname, E-Mail, Nachricht).',
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f7f4; border-radius: 0; overflow: hidden;">
      <div style="background: #244721; padding: 32px 24px; text-align: center;">
        <h1 style="color: #f8f7f4; font-size: 22px; margin: 0; font-weight: 600;">Neue Kontaktanfrage</h1>
        <p style="color: #a3b899; font-size: 14px; margin: 8px 0 0;">über matterhillgarten.ch</p>
      </div>
      <div style="padding: 32px 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #6b6b5e; font-size: 13px; width: 140px; vertical-align: top;">Vorname</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #2a2a24; font-size: 15px;">${escapeHtml(vorname)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #6b6b5e; font-size: 13px; vertical-align: top;">Nachname</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #2a2a24; font-size: 15px;">${escapeHtml(nachname)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #6b6b5e; font-size: 13px; vertical-align: top;">E-Mail</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #2a2a24; font-size: 15px;"><a href="mailto:${escapeHtml(email)}" style="color: #244721;">${escapeHtml(email)}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #6b6b5e; font-size: 13px; vertical-align: top;">Telefon</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #2a2a24; font-size: 15px;">${telefon ? escapeHtml(telefon) : '–'}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #6b6b5e; font-size: 13px; vertical-align: top;">Leistung</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e1d8; color: #2a2a24; font-size: 15px;">${leistung ? escapeHtml(leistung) : '–'}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #6b6b5e; font-size: 13px; vertical-align: top;">Nachricht</td>
            <td style="padding: 12px 0; color: #2a2a24; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(nachricht)}</td>
          </tr>
        </table>
      </div>
      <div style="background: #eae6dd; padding: 16px 24px; text-align: center;">
        <p style="color: #6b6b5e; font-size: 12px; margin: 0;">Diese Nachricht wurde über das Kontaktformular auf matterhillgarten.ch gesendet.</p>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Matter & Hill Webformular <onboarding@resend.dev>',
      to: ['info@matterhillgarten.ch'],
      replyTo: email,
      subject: `Kontaktanfrage von ${vorname} ${nachname}`,
      html: htmlBody,
    });

    if (error) {
      console.error('Resend API error:', error);
      return res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden.' });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
