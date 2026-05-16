import { logger } from './logger.js';

class Cache {
  constructor(defaultTTL = 300) {
    this.store = new Map();
    this.defaultTTL = defaultTTL;
    this.maxSize = 500;
  }

  set(key, value, ttl = this.defaultTTL) {
    if (this.store.size >= this.maxSize) {
      this._evict();
    }

    const expiresAt = Date.now() + ttl * 1000;
    this.store.set(key, { value, expiresAt });
    logger.debug('Cache', `SET ${key} (TTL: ${ttl}s)`);
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      logger.debug('Cache', `EXPIRED ${key}`);
      return undefined;
    }

    logger.debug('Cache', `HIT ${key}`);
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  del(key) {
    this.store.delete(key);
    logger.debug('Cache', `DEL ${key}`);
  }

  clear() {
    this.store.clear();
    logger.info('Cache', 'Cleared');
  }

  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
    logger.debug('Cache', `Invalidated prefix ${prefix}`);
  }

  _evict() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        return;
      }
    }

    const oldestKey = this.store.keys().next().value;
    if (oldestKey) {
      this.store.delete(oldestKey);
      logger.debug('Cache', `Evicted oldest key ${oldestKey}`);
    }
  }

  get size() {
    return this.store.size;
  }
}

export const cache = new Cache();
