export class AppError extends Error {
  constructor(message, statusCode = 500, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SupabaseError extends AppError {
  constructor(message, context = {}) {
    super(message, 503, { service: 'supabase', ...context });
  }
}

export class AIError extends AppError {
  constructor(message, context = {}) {
    super(message, 502, { service: 'ai', ...context });
  }
}

export class ValidationError extends AppError {
  constructor(message, context = {}) {
    super(message, 400, { type: 'validation', ...context });
  }
}

export class CacheError extends AppError {
  constructor(message, context = {}) {
    super(message, 500, { service: 'cache', ...context });
  }
}
