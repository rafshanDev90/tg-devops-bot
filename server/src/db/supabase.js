import { createClient } from '@supabase/supabase-js';
import { SupabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class SupabaseClient {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    const url = process.env.SUPABASE_API_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_PUBLIC_URL;

    if (!url || !key) {
      logger.warn('Supabase', 'SUPABASE_API_URL or SUPABASE_SERVICE_KEY not set. Supabase features disabled.');
      return;
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false },
      global: { headers: { 'x-client-info': 'sms-bot/1.0' } },
    });

    this.initialized = true;
    logger.info('Supabase', 'Client initialized');
  }

  get isReady() {
    return this.initialized && this.client !== null;
  }

  async _retry(fn, operationName) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const isRetryable = this._isRetryable(error);
        logger.warn('Supabase', `${operationName} attempt ${attempt} failed`, {
          retryable: isRetryable,
          error: error.message,
        });
        if (!isRetryable || attempt === MAX_RETRIES) break;
        await this._delay(RETRY_DELAY_MS * attempt);
      }
    }
    throw new SupabaseError(`${operationName} failed after ${MAX_RETRIES} retries`, {
      originalError: lastError?.message,
    });
  }

  _isRetryable(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return msg.includes('timeout') || msg.includes('rate limit') || msg.includes('503') || msg.includes('network');
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async query(table, options = {}) {
    if (!this.isReady) throw new SupabaseError('Supabase client not initialized');

    const { select = '*', filters = {}, order = null, limit = null } = options;

    return this._retry(async () => {
      let query = this.client.from(table).select(select);

      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'object' && value !== null) {
          for (const [op, val] of Object.entries(value)) {
            query = query[op](key, val);
          }
        } else {
          query = query.eq(key, value);
        }
      }

      if (order) {
        query = query.order(order.column, { ascending: order.ascending ?? true });
      }
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw new Error(`${error.code}: ${error.message}`);
      return data;
    }, `query(${table})`);
  }

  async insert(table, rows) {
    if (!this.isReady) throw new SupabaseError('Supabase client not initialized');

    return this._retry(async () => {
      const { data, error } = await this.client.from(table).insert(rows).select();
      if (error) throw new Error(`${error.code}: ${error.message}`);
      return data;
    }, `insert(${table})`);
  }

  async delete(table, filters) {
    if (!this.isReady) throw new SupabaseError('Supabase client not initialized');

    return this._retry(async () => {
      let query = this.client.from(table).delete();
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      const { error } = await query;
      if (error) throw new Error(`${error.code}: ${error.message}`);
    }, `delete(${table})`);
  }
}

export const supabase = new SupabaseClient();
