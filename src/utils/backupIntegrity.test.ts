import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBackupChecksum,
  createBackupSha256,
  verifyBackupChecksum,
  verifyBackupSha256,
} from './backupIntegrity';

test('backup checksum is stable when JSON object key order changes', () => {
  const first = { backupVersion: 1, records: { customers: [], sales: [] } };
  const reordered = { records: { sales: [], customers: [] }, backupVersion: 1 };

  assert.equal(createBackupChecksum(first), createBackupChecksum(reordered));
});

test('backup checksum detects content changes while ignoring its own checksum field', () => {
  const backup = { backupVersion: 1, records: { customers: [{ id: 'customer-1' }] } };
  const checksum = createBackupChecksum(backup);
  const checkedBackup = { ...backup, integrityChecksum: checksum };

  assert.equal(verifyBackupChecksum(checkedBackup), 'valid');
  assert.equal(verifyBackupChecksum({ ...checkedBackup, records: { customers: [] } }), 'invalid');
  assert.equal(verifyBackupChecksum(backup), 'missing');
});

test('rejects malformed checksum values', () => {
  assert.equal(verifyBackupChecksum({ integrityChecksum: 'not-a-checksum' }), 'invalid');
});

test('SHA-256 backup integrity is stable and detects content changes', async () => {
  const backup = { backupVersion: 1, records: { customers: [{ id: 'customer-1' }] } };
  const checksum = await createBackupSha256(backup);
  const checkedBackup = { ...backup, sha256Checksum: checksum };

  assert.match(checksum, /^sha256:[0-9a-f]{64}$/);
  assert.equal(await verifyBackupSha256(checkedBackup), 'valid');
  assert.equal(await verifyBackupSha256({
    ...checkedBackup,
    records: { customers: [] },
  }), 'invalid');
  assert.equal(await verifyBackupSha256(backup), 'missing');
});
