// Shared building blocks for the emails the auth module sends.

export type EmailContent = {
  subject: string;
  // Plain-text version, shown by email apps that do not render HTML.
  text: string;
  html: string;
};

const BRAND_COLOR = '#3431E4';

// Names come from users, so they must be escaped before going into HTML.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The frame every email shares: width, font and the Diraya name on top.
export function wrapHtml(bodyHtml: string): string {
  return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #171a2b;">
  <p style="font-size: 20px; font-weight: bold; margin: 0 0 24px;">Diraya</p>
  ${bodyHtml}
</div>`.trim();
}

export function buttonHtml(label: string, link: string): string {
  return `
  <p style="margin: 28px 0;">
    <a href="${link}" style="background: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">${label}</a>
  </p>`;
}

// Small grey paragraph for the fine print.
export function noteHtml(text: string): string {
  return `
  <p style="font-size: 14px; color: #555b70;">${text}</p>`;
}
