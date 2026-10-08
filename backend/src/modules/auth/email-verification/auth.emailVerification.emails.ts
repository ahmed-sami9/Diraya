// The email a new teacher gets after signing up with a password.

import {
  escapeHtml,
  wrapHtml,
  buttonHtml,
  noteHtml,
  type EmailContent,
} from '../shared/auth.emailTemplates';

export function buildVerificationEmail(input: {
  fullName: string;
  verificationLink: string;
  expiresInHours: number;
}): EmailContent {
  const { fullName, verificationLink, expiresInHours } = input;

  // This sentence matters for security, not just politeness. Someone can type
  // another person's email into the sign-up form; the real owner must be told
  // clearly NOT to click if they did not sign up themselves.
  const notYou =
    "If you didn't create a Diraya account, don't click the link. You can ignore this email and nothing will happen.";

  return {
    subject: 'Confirm your email for Diraya',

    text: [
      `Hi ${fullName},`,
      '',
      'Welcome to Diraya. Open this link to confirm your email address and finish creating your account:',
      '',
      verificationLink,
      '',
      `The link works once and expires in ${expiresInHours} hours.`,
      '',
      notYou,
    ].join('\n'),

    html: wrapHtml(`
  <p>Hi ${escapeHtml(fullName)},</p>
  <p>Welcome to Diraya. Click the button to confirm your email address and finish creating your account.</p>${buttonHtml('Confirm my email', verificationLink)}${noteHtml(`The link works once and expires in ${expiresInHours} hours.`)}${noteHtml(notYou)}`),
  };
}
