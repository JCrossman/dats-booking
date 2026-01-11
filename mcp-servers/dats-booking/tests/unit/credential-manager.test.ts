import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialManager } from '../../src/auth/credential-manager.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';

describe('CredentialManager', () => {
  let manager: CredentialManager;
  let storagePath: string;

  beforeEach(() => {
    manager = new CredentialManager();
    storagePath = manager.getStoragePath();
  });

  afterEach(async () => {
    if (existsSync(storagePath)) {
      unlinkSync(storagePath);
    }
  });

  it('should store and retrieve credentials', async () => {
    const credentials = {
      clientId: '123456',
      passcode: 'testpass123',
    };

    await manager.store(credentials);
    const retrieved = await manager.retrieve();

    expect(retrieved.clientId).toBe(credentials.clientId);
    expect(retrieved.passcode).toBe(credentials.passcode);
  });

  it('should report hasCredentials correctly', async () => {
    expect(manager.hasCredentials()).toBe(false);

    await manager.store({ clientId: '123', passcode: 'pass' });

    expect(manager.hasCredentials()).toBe(true);
  });

  it('should throw when retrieving without credentials', async () => {
    await expect(manager.retrieve()).rejects.toThrow('Credentials not found');
  });

  it('should encrypt credentials at rest', async () => {
    await manager.store({ clientId: 'sensitive', passcode: 'secret' });

    const fileContent = readFileSync(storagePath, 'utf8');
    const parsed = JSON.parse(fileContent);

    expect(parsed.iv).toBeDefined();
    expect(parsed.authTag).toBeDefined();
    expect(parsed.data).toBeDefined();
    expect(parsed.createdAt).toBeDefined();

    expect(fileContent).not.toContain('sensitive');
    expect(fileContent).not.toContain('secret');
  });

  it('should delete credentials', async () => {
    await manager.store({ clientId: '123', passcode: 'pass' });
    expect(manager.hasCredentials()).toBe(true);

    await manager.delete();
    expect(manager.hasCredentials()).toBe(false);
  });

  it('should overwrite existing credentials', async () => {
    await manager.store({ clientId: 'first', passcode: 'pass1' });
    await manager.store({ clientId: 'second', passcode: 'pass2' });

    const retrieved = await manager.retrieve();
    expect(retrieved.clientId).toBe('second');
    expect(retrieved.passcode).toBe('pass2');
  });
});
