import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowIosSafariInstallInstructions } from './pwaService.ts';

test('manual install guidance is limited to Safari on iOS devices', () => {
  assert.equal(
    shouldShowIosSafariInstallInstructions(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5
    ),
    true
  );
  assert.equal(
    shouldShowIosSafariInstallInstructions(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5
    ),
    false
  );
  assert.equal(
    shouldShowIosSafariInstallInstructions(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'MacIntel',
      0
    ),
    false
  );
});

test('manual install guidance recognizes iPadOS desktop-mode Safari', () => {
  assert.equal(
    shouldShowIosSafariInstallInstructions(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'MacIntel',
      5
    ),
    true
  );
});
