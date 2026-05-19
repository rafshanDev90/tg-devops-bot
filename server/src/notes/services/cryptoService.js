import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

class CryptoService {
  constructor() {
    this.key = process.env.NOTES_ENCRYPTION_KEY;
    if (!this.key) {
      logger.warn('CryptoService', 'NOTES_ENCRYPTION_KEY not set. Encryption disabled.');
      this.enabled = false;
    } else {
      this.enabled = true;
      this.keyBuffer = Buffer.from(this.key, 'hex');
      if (this.keyBuffer.length !== KEY_LENGTH) {
        logger.error('CryptoService', 'Invalid key length. Must be 32 bytes (64 hex chars).');
        this.enabled = false;
      }
    }
  }

  encrypt(plainText) {
    if (!this.enabled || !plainText) return { encrypted: plainText, success: false };

    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, this.keyBuffer, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag().toString('base64');
      return {
        encrypted: `${iv.toString('base64')}:${authTag}:${encrypted}`,
        success: true
      };
    } catch (err) {
      logger.error('CryptoService', 'Encryption failed', { error: err.message });
      return { encrypted: plainText, success: false };
    }
  }

  decrypt(cipherText) {
    if (!this.enabled || !cipherText) return { decrypted: cipherText, success: false };

    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) {
        logger.warn('CryptoService', 'Invalid cipher text format');
        return { decrypted: cipherText, success: false };
      }

      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(ALGORITHM, this.keyBuffer, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return { decrypted, success: true };
    } catch (err) {
      logger.error('CryptoService', 'Decryption failed', { error: err.message });
      return { decrypted: '[Decryption Failed]', success: false };
    }
  }

  generateKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }
}

export const cryptoService = new CryptoService();
