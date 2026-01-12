import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../src/auth/session-manager.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';

describe('SessionManager', () => {
  let manager: SessionManager;
  let storagePath: string;

  beforeEach(() => {
    manager = new SessionManager();
    storagePath = manager.getStoragePath();
  });

  afterEach(async () => {
    if (existsSync(storagePath)) {
      unlinkSync(storagePath);
    }
  });

  it('should store and retrieve session', async () => {
    const session = {
      sessionCookie: 'SessionId=abc123; BIGipServer=xyz',
      clientId: '46642',
      createdAt: new Date().toISOString(),
    };

    await manager.store(session);
    const retrieved = await manager.retrieve();

    expect(retrieved.sessionCookie).toBe(session.sessionCookie);
    expect(retrieved.clientId).toBe(session.clientId);
    expect(retrieved.createdAt).toBe(session.createdAt);
  });

  it('should report hasSession correctly', async () => {
    expect(manager.hasSession()).toBe(false);

    await manager.store({
      sessionCookie: 'test',
      clientId: '123',
      createdAt: new Date().toISOString(),
    });

    expect(manager.hasSession()).toBe(true);
  });

  it('should throw when retrieving without session', async () => {
    await expect(manager.retrieve()).rejects.toThrow('No session found');
  });

  it('should encrypt session at rest', async () => {
    await manager.store({
      sessionCookie: 'SensitiveSessionCookie=secret123',
      clientId: '46642',
      createdAt: new Date().toISOString(),
    });

    const fileContent = readFileSync(storagePath, 'utf8');
    const parsed = JSON.parse(fileContent);

    // Should have encryption metadata
    expect(parsed.iv).toBeDefined();
    expect(parsed.authTag).toBeDefined();
    expect(parsed.data).toBeDefined();
    expect(parsed.createdAt).toBeDefined();

    // Should NOT contain plaintext sensitive data
    expect(fileContent).not.toContain('SensitiveSessionCookie');
    expect(fileContent).not.toContain('secret123');
    expect(fileContent).not.toContain('46642');
  });

  it('should clear session', async () => {
    await manager.store({
      sessionCookie: 'test',
      clientId: '123',
      createdAt: new Date().toISOString(),
    });
    expect(manager.hasSession()).toBe(true);

    await manager.clear();
    expect(manager.hasSession()).toBe(false);
  });

  it('should overwrite existing session', async () => {
    await manager.store({
      sessionCookie: 'first',
      clientId: '111',
      createdAt: new Date().toISOString(),
    });
    await manager.store({
      sessionCookie: 'second',
      clientId: '222',
      createdAt: new Date().toISOString(),
    });

    const retrieved = await manager.retrieve();
    expect(retrieved.sessionCookie).toBe('second');
    expect(retrieved.clientId).toBe('222');
  });

  it('should return session age', async () => {
    const now = new Date();
    await manager.store({
      sessionCookie: 'test',
      clientId: '123',
      createdAt: now.toISOString(),
    });

    const age = await manager.getSessionAge();
    expect(age).toBeDefined();
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(1000); // Should be less than 1 second old
  });

  it('should return null age when no session exists', async () => {
    const age = await manager.getSessionAge();
    expect(age).toBeNull();
  });

  it('should migrate from old credentials.enc file', async () => {
    // This test verifies the migration method exists and returns boolean
    const migrated = await manager.migrateFromCredentials();
    expect(typeof migrated).toBe('boolean');
  });
});
