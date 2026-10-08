// The two emails the password reset flow sends. Each builder returns a
// plain-text and an HTML version of the same message.

import {
  escapeHtml,
  wrapHtml,
  buttonHtml,
  noteHtml,
  type EmailContent,
} from '../shared/auth.emailTemplates';

export function buildPasswordResetEmail(input: {
  fullName: string;
  resetLink: string;
  expiresInMinutes: number;
}): EmailContent {
  const { fullName, resetLink, expiresInMinutes } = input;

  return {
    subject: 'Reset your Diraya password',

    text: [
      `Hi ${fullName},`,
      '',
      'We received a request to reset your Diraya password. Open this link to choose a new one:',
      '',
      resetLink,
      '',
      `The link works once and expires in ${expiresInMinutes} minutes.`,
      '',
      "If you didn't ask for this, you can ignore this email. Your password stays the same.",
    ].join('\n'),

    html: wrapHtml(`
  <p>Hi ${escapeHtml(fullName)},</p>
  <p>We received a request to reset your Diraya password. Click the button to choose a new one.</p>${buttonHtml('Reset password', resetLink)}${noteHtml(`The link works once and expires in ${expiresInMinutes} minutes.`)}${noteHtml("If you didn't ask for this, you can ignore this email. Your password stays the same.")}`),
  };
}

export function buildPasswordChangedEmail(input: { fullName: string }): EmailContent {
  return {
    subject: 'Your Diraya password was changed',

    text: [
      `Hi ${input.fullName},`,
      '',
      'Your Diraya password was just changed, and you were signed out on all devices.',
      '',
      "If this was you, there is nothing more to do. If it wasn't, reset your password right away from the sign-in page.",
    ].join('\n'),

    html: wrapHtml(`
  <p>Hi ${escapeHtml(input.fullName)},</p>
  <p>Your Diraya password was just changed, and you were signed out on all devices.</p>${noteHtml("If this was you, there is nothing more to do. If it wasn't, reset your password right away from the sign-in page.")}`),
  };
}
