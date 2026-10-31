// Egyptian mobile numbers, as parents and students type them.
//
// People write the same number in many ways: "010 1234 5678",
// "010-1234-5678", "+20 10 1234 5678". normalizePhone turns all of them into
// one form, "01012345678", so the database stores one spelling and searching
// or comparing numbers works.

// 11 digits: 01, then the network (0 Vodafone, 1 Etisalat, 2 Orange, 5 WE),
// then 8 more digits.
const EGYPT_MOBILE = /^01[0125]\d{8}$/;

export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');

  // +20 10… or 0020 10… (the international form) -> 010…
  if (digits.startsWith('0020')) digits = digits.slice(4);
  if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;

  return digits;
}

export const isValidEgyptMobile = (normalized: string) => EGYPT_MOBILE.test(normalized);

// "01012345678" -> "201012345678": tel: and WhatsApp links want the country
// code instead of the leading 0.
export const toInternational = (normalized: string) => `20${normalized.slice(1)}`;

// A WhatsApp chat with this number, `text` already typed. Phones open the app
// (wa.me); computers go straight to WhatsApp Web, skipping wa.me's extra page.
export function whatsappChatUrl(
  normalized: string,
  { text, onPhone }: { text?: string; onPhone: boolean }
): string {
  const number = toInternational(normalized);
  const message = text ? encodeURIComponent(text) : '';

  if (onPhone) return `https://wa.me/${number}${message && `?text=${message}`}`;

  return `https://web.whatsapp.com/send?phone=${number}${message && `&text=${message}`}`;
}

// "01012345678" -> "010 1234 5678", easier to read and to check by eye.
export function formatPhone(normalized: string): string {
  if (normalized.length !== 11) return normalized;

  return `${normalized.slice(0, 3)} ${normalized.slice(3, 7)} ${normalized.slice(7)}`;
}
