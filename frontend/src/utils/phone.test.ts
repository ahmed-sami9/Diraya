// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { whatsappChatUrl } from './phone.ts';

describe('whatsappChatUrl', () => {
  it('phones open the app through wa.me', () => {
    assert.equal(
      whatsappChatUrl('01012345678', { text: 'Hi', onPhone: true }),
      'https://wa.me/201012345678?text=Hi'
    );
  });

  it('computers go straight to WhatsApp Web', () => {
    assert.equal(
      whatsappChatUrl('01012345678', { text: 'Hi', onPhone: false }),
      'https://web.whatsapp.com/send?phone=201012345678&text=Hi'
    );
  });

  it('new lines, stars and & survive the trip', () => {
    const url = whatsappChatUrl('01012345678', { text: '*A* & B\nC?', onPhone: true });
    const text = new URL(url).searchParams.get('text');

    assert.equal(text, '*A* & B\nC?');
  });

  it('no text: just the chat', () => {
    assert.equal(whatsappChatUrl('01012345678', { onPhone: true }), 'https://wa.me/201012345678');
  });
});
