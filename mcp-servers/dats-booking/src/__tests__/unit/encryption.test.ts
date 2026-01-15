import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveKey, generateKey } from '../../auth/encryption.js';

/**
 * Unit tests for encryption module
 *
 * Tests cover:
 * - AES-256-GCM encryption/decryption roundtrip
 * - Authentication tag validation
 * - IV validation
 * - Key derivation consistency
 * - Random key generation
 *
 * Ensures session data is securely encrypted at rest.
 */

describe('encrypt and decrypt', () => {
  describe('Roundtrip Encryption', () => {
    it('should encrypt and decrypt simple text', () => {
      const plaintext = 'Hello, World!';
      const key = Buffer.from('a'.repeat(64), 'hex'); // 32-byte key

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, iv, authTag, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt JSON session data', () => {
      const sessionData = JSON.stringify({
        sessionCookie: 'ASP.NET_SessionId=abc123',
        clientId: '12345',
        createdAt: '2026-01-15T10:00:00Z',
      });
      const key = Buffer.from('b'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(sessionData, key);
      const decrypted = decrypt(encrypted, iv, authTag, key);

      expect(decrypted).toBe(sessionData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(sessionData));
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const key = Buffer.from('c'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, iv, authTag, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long text', () => {
      const plaintext = 'a'.repeat(10000); // 10KB of text
      const key = Buffer.from('d'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, iv, authTag, key);

      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(10000);
    });

    it('should handle Unicode characters', () => {
      const plaintext = '你好世界 🌍 café';
      const key = Buffer.from('e'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, iv, authTag, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'Special: !@#$%^&*()_+{}|:"<>?';
      const key = Buffer.from('f'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, iv, authTag, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle newlines and control characters', () => {
      const plaintext = 'Line 1\nLine 2\r\nLine 3\tTabbed';
      const key = Buffer.from('0'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, iv, authTag, key);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Encryption Properties', () => {
    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'Same text';
      const key = Buffer.from('1'.repeat(64), 'hex');

      const result1 = encrypt(plaintext, key);
      const result2 = encrypt(plaintext, key);

      // Different IVs
      expect(result1.iv).not.toBe(result2.iv);

      // Different ciphertexts
      expect(result1.encrypted).not.toBe(result2.encrypted);

      // But both decrypt to same plaintext
      expect(decrypt(result1.encrypted, result1.iv, result1.authTag, key)).toBe(plaintext);
      expect(decrypt(result2.encrypted, result2.iv, result2.authTag, key)).toBe(plaintext);
    });

    it('should return base64-encoded values', () => {
      const plaintext = 'Test';
      const key = Buffer.from('2'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);

      // Base64 format: alphanumeric + / + = characters
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(iv).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(authTag).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should produce 16-byte IV (22 chars base64)', () => {
      const plaintext = 'Test';
      const key = Buffer.from('3'.repeat(64), 'hex');

      const { iv } = encrypt(plaintext, key);

      // 16 bytes = 22 base64 characters (with padding)
      const ivBuffer = Buffer.from(iv, 'base64');
      expect(ivBuffer.length).toBe(16);
    });

    it('should produce 16-byte auth tag', () => {
      const plaintext = 'Test';
      const key = Buffer.from('4'.repeat(64), 'hex');

      const { authTag } = encrypt(plaintext, key);

      const authTagBuffer = Buffer.from(authTag, 'base64');
      expect(authTagBuffer.length).toBe(16);
    });
  });

  describe('Authentication and Tampering', () => {
    it('should reject decryption with invalid auth tag', () => {
      const plaintext = 'Secret data';
      const key = Buffer.from('5'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);

      // Corrupt the auth tag
      const corruptedAuthTag = Buffer.from(authTag, 'base64');
      corruptedAuthTag[0] ^= 0xff; // Flip bits
      const badAuthTag = corruptedAuthTag.toString('base64');

      // Should throw error
      expect(() => {
        decrypt(encrypted, iv, badAuthTag, key);
      }).toThrow();
    });

    it('should reject decryption with tampered ciphertext', () => {
      const plaintext = 'Secret data';
      const key = Buffer.from('6'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);

      // Corrupt the ciphertext
      const corruptedEncrypted = Buffer.from(encrypted, 'base64');
      corruptedEncrypted[0] ^= 0xff; // Flip bits
      const badEncrypted = corruptedEncrypted.toString('base64');

      // Should throw error (auth tag won't match)
      expect(() => {
        decrypt(badEncrypted, iv, authTag, key);
      }).toThrow();
    });

    it('should reject decryption with invalid IV', () => {
      const plaintext = 'Secret data';
      const key = Buffer.from('7'.repeat(64), 'hex');

      const { encrypted, authTag } = encrypt(plaintext, key);

      // Use wrong IV (random)
      const wrongIv = Buffer.from('8'.repeat(32), 'hex').toString('base64').slice(0, 22) + '==';

      // Should throw error or produce garbage
      expect(() => {
        decrypt(encrypted, wrongIv, authTag, key);
      }).toThrow();
    });

    it('should reject decryption with wrong key', () => {
      const plaintext = 'Secret data';
      const key = Buffer.from('9'.repeat(64), 'hex');
      const wrongKey = Buffer.from('a'.repeat(64), 'hex');

      const { encrypted, iv, authTag } = encrypt(plaintext, key);

      // Should throw error
      expect(() => {
        decrypt(encrypted, iv, authTag, wrongKey);
      }).toThrow();
    });
  });
});

describe('deriveKey', () => {
  it('should derive consistent key from same input', () => {
    const password = 'my-secret-password';
    const salt = 'my-salt';

    const key1 = deriveKey(password, salt);
    const key2 = deriveKey(password, salt);

    expect(key1).toEqual(key2);
    expect(key1.toString('hex')).toBe(key2.toString('hex'));
  });

  it('should produce 32-byte key', () => {
    const key = deriveKey('password', 'salt');

    expect(key.length).toBe(32);
  });

  it('should produce different keys for different passwords', () => {
    const key1 = deriveKey('password1', 'salt');
    const key2 = deriveKey('password2', 'salt');

    expect(key1).not.toEqual(key2);
  });

  it('should produce different keys for different salts', () => {
    const key1 = deriveKey('password', 'salt1');
    const key2 = deriveKey('password', 'salt2');

    expect(key1).not.toEqual(key2);
  });

  it('should work with encryption/decryption', () => {
    const password = 'user-password';
    const salt = 'dats-booking-salt';
    const key = deriveKey(password, salt);

    const plaintext = 'Session data';
    const { encrypted, iv, authTag } = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, iv, authTag, key);

    expect(decrypted).toBe(plaintext);
  });

  it('should be deterministic (same input always produces same key)', () => {
    const keys = [];
    for (let i = 0; i < 10; i++) {
      keys.push(deriveKey('test-password', 'test-salt'));
    }

    // All keys should be identical
    const firstKey = keys[0].toString('hex');
    keys.forEach((key) => {
      expect(key.toString('hex')).toBe(firstKey);
    });
  });
});

describe('generateKey', () => {
  it('should generate hex-encoded key', () => {
    const key = generateKey();

    // Should be hex string (only 0-9 a-f characters)
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate 64-character hex string (32 bytes)', () => {
    const key = generateKey();

    // 32 bytes = 64 hex characters
    expect(key.length).toBe(64);
  });

  it('should generate different keys each time', () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const key3 = generateKey();

    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
    expect(key1).not.toBe(key3);
  });

  it('should generate keys that work with encryption', () => {
    const keyHex = generateKey();
    const key = Buffer.from(keyHex, 'hex');

    const plaintext = 'Test encryption';
    const { encrypted, iv, authTag } = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, iv, authTag, key);

    expect(decrypted).toBe(plaintext);
  });

  it('should generate cryptographically random keys', () => {
    // Generate multiple keys and check they're all different
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      keys.add(generateKey());
    }

    // All 100 keys should be unique
    expect(keys.size).toBe(100);
  });
});

describe('Integration Scenarios', () => {
  it('should support session encryption workflow', () => {
    // Simulate session storage workflow
    const password = process.env.DATS_ENCRYPTION_KEY || 'default-password';
    const key = deriveKey(password, 'dats-booking-mcp-salt');

    const session = {
      sessionCookie: 'ASP.NET_SessionId=xyz789',
      clientId: '54321',
      createdAt: new Date().toISOString(),
    };

    // Encrypt session
    const sessionJson = JSON.stringify(session);
    const { encrypted, iv, authTag } = encrypt(sessionJson, key);

    // Store to "database" (simulated)
    const storedData = { encrypted, iv, authTag };

    // Retrieve from "database"
    const decrypted = decrypt(storedData.encrypted, storedData.iv, storedData.authTag, key);
    const retrievedSession = JSON.parse(decrypted);

    expect(retrievedSession).toEqual(session);
  });

  it('should support key rotation scenario', () => {
    const oldPassword = 'old-password';
    const newPassword = 'new-password';
    const salt = 'salt';

    const oldKey = deriveKey(oldPassword, salt);
    const newKey = deriveKey(newPassword, salt);

    const plaintext = 'Session data';

    // Encrypt with old key
    const { encrypted: oldEncrypted, iv: oldIv, authTag: oldAuthTag } = encrypt(plaintext, oldKey);

    // Decrypt with old key
    const decrypted = decrypt(oldEncrypted, oldIv, oldAuthTag, oldKey);

    // Re-encrypt with new key
    const { encrypted: newEncrypted, iv: newIv, authTag: newAuthTag } = encrypt(decrypted, newKey);

    // Verify new encryption works
    const finalDecrypted = decrypt(newEncrypted, newIv, newAuthTag, newKey);
    expect(finalDecrypted).toBe(plaintext);
  });
});
