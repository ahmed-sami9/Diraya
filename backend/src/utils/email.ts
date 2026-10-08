// Sends email through Resend's HTTP API (https://resend.com).
//
// It uses plain fetch, so no extra package is needed. To switch provider
// later, this is the only file that has to change.

type EmailMessage = {
  to: string;
  subject: string;
  // Plain-text version, shown by email apps that do not render HTML.
  text: string;
  html: string;
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Resend's shared test sender. It works without setting up a domain, but
// only delivers to the email address of your own Resend account.
const DEFAULT_FROM = 'Diraya <onboarding@resend.dev>';

const isProduction = () => process.env.NODE_ENV === 'production';

// Development only: shows the email in the backend terminal, so a flow can be
// finished (by copying the link) even when no real email goes out.
function printEmail(message: EmailMessage, reason: string): void {
  console.log(
    [
      '',
      `---------------- EMAIL (not sent: ${reason}) ----------------`,
      `To:      ${message.to}`,
      `Subject: ${message.subject}`,
      '',
      message.text,
      '--------------------------------------------------------------',
      '',
    ].join('\n')
  );
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // In production a missing key is a real configuration error.
    if (isProduction()) {
      throw new Error('RESEND_API_KEY environment variable is missing.');
    }

    printEmail(message, 'RESEND_API_KEY is not set');
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (response.ok) return;

  const details = await response.text().catch(() => '');

  // In production a refused email is a real failure the caller must know about.
  if (isProduction()) {
    throw new Error(`Email could not be sent (status ${response.status}). ${details}`);
  }

  // In development, Resend's test sender refuses every recipient except the
  // Resend account's own address (status 403). Print the email instead, so
  // sign-up and password reset can still be tested with any address.
  console.warn(`Resend refused the email (status ${response.status}). ${details}`);
  printEmail(message, `Resend refused it, status ${response.status}`);
}
