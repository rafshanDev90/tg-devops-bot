export const CATEGORIES = Object.freeze({
  CREDENTIALS: 'credentials',
  REQUIREMENTS: 'requirements',
  MEETINGS: 'meetings',
  SNIPPETS: 'snippets',
  SERVERS: 'servers',
  OTHER: 'other',
});

export const CATEGORY_LABELS = {
  credentials: '🔑 Credentials',
  requirements: '📋 Requirements',
  meetings: '🤝 Meetings',
  snippets: '💻 Snippets',
  servers: '🖥️ Servers',
  other: '📌 Other',
};

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 4000;
export const MAX_TAGS = 5;

export class NoteDomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'NoteDomainError';
    this.code = code;
  }
}

export function validateNoteInput({ title, content, category, tags }) {
  if (!title || title.trim().length === 0) {
    throw new NoteDomainError('Title cannot be empty', 'EMPTY_TITLE');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new NoteDomainError(`Title must be under ${MAX_TITLE_LENGTH} characters`, 'TITLE_TOO_LONG');
  }
  if (!content || content.trim().length === 0) {
    throw new NoteDomainError('Content cannot be empty', 'EMPTY_CONTENT');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new NoteDomainError(`Content must be under ${MAX_CONTENT_LENGTH} characters`, 'CONTENT_TOO_LONG');
  }
  if (category && !Object.values(CATEGORIES).includes(category)) {
    throw new NoteDomainError('Invalid category', 'INVALID_CATEGORY');
  }
  if (tags && tags.length > MAX_TAGS) {
    throw new NoteDomainError(`Maximum ${MAX_TAGS} tags allowed`, 'TOO_MANY_TAGS');
  }
}

export function maskContent() {
  return '••••••••••••';
}

export function generatePreview(content, maxLength = 100) {
  if (!content) return '';
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
}
