// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isMobileDevice } from './device.ts';

const UA = {
  android:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
};

describe('isMobileDevice', () => {
  it('phones', () => {
    assert.equal(isMobileDevice({ userAgent: UA.android, maxTouchPoints: 5 }), true);
    assert.equal(isMobileDevice({ userAgent: UA.iphone, maxTouchPoints: 5 }), true);
  });

  it('computers, even a touch-screen laptop', () => {
    assert.equal(isMobileDevice({ userAgent: UA.windows, maxTouchPoints: 0 }), false);
    assert.equal(isMobileDevice({ userAgent: UA.windows, maxTouchPoints: 10 }), false);
    assert.equal(isMobileDevice({ userAgent: UA.mac, maxTouchPoints: 0 }), false);
  });

  it('an iPad pretending to be a Mac', () => {
    assert.equal(isMobileDevice({ userAgent: UA.mac, maxTouchPoints: 5 }), true);
  });

  it('trusts the browser when it says mobile', () => {
    assert.equal(
      isMobileDevice({ userAgent: UA.windows, maxTouchPoints: 0, userAgentData: { mobile: true } }),
      true
    );
  });
});
