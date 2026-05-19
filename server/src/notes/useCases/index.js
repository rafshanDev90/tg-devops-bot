import { noteRepository } from '../repositories/noteRepository.js';
import { cryptoService } from '../services/cryptoService.js';
import { validateNoteInput, NoteDomainError } from '../domain/noteEntity.js';
import { logger } from '../../utils/logger.js';

export class CreateNoteUseCase {
  async execute({ userId, title, content, category, tags, encrypt }) {
    try {
      validateNoteInput({ title, content, category, tags });

      let finalContent = content;
      let isEncrypted = false;

      if (encrypt && cryptoService.enabled) {
        const result = cryptoService.encrypt(content);
        if (result.success) {
          finalContent = result.encrypted;
          isEncrypted = true;
        }
      }

      const result = await noteRepository.create({
        userId,
        title: title.trim(),
        content: finalContent,
        category: category || 'other',
        tags: tags ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [],
        isEncrypted,
        metadata: { createdFrom: 'bot' }
      });

      if (!result.success) {
        throw new NoteDomainError('Failed to save note', 'SAVE_FAILED');
      }

      logger.info('CreateNoteUseCase', 'Note created', { userId, noteId: result.data._id, title: result.data.title });
      return { success: true, data: result.data };
    } catch (err) {
      logger.error('CreateNoteUseCase', 'Execution failed', { error: err.message });
      return { success: false, error: err.message, code: err.code };
    }
  }
}

export class ListNotesUseCase {
  async execute({ userId, category, tag, page = 1, limit = 10 }) {
    try {
      const result = await noteRepository.findByUser(userId, { category, tag, page, limit });
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const notes = result.data.map(n => ({
        id: n._id,
        title: n.title,
        category: n.category,
        tags: n.tags,
        isEncrypted: n.isEncrypted,
        createdAt: n.createdAt,
        preview: n.isEncrypted ? '🔒 Encrypted' : n.content.substring(0, 80) + (n.content.length > 80 ? '...' : ''),
      }));

      return { success: true, data: notes, total: result.total, page: result.page, hasMore: result.hasMore };
    } catch (err) {
      logger.error('ListNotesUseCase', 'Execution failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export class ViewNoteUseCase {
  async execute({ userId, noteId, reveal = false }) {
    try {
      const result = await noteRepository.findById(noteId, userId);
      if (!result.success || !result.data) {
        return { success: false, error: 'Note not found', code: 'NOT_FOUND' };
      }

      await noteRepository.trackView(noteId);

      let content = result.data.content;
      if (result.data.isEncrypted && reveal) {
        const decrypted = cryptoService.decrypt(content);
        content = decrypted.decrypted;
      } else if (result.data.isEncrypted) {
        content = '🔒 Encrypted — tap Reveal to view';
      }

      return {
        success: true,
        data: {
          id: result.data._id,
          title: result.data.title,
          content,
          category: result.data.category,
          tags: result.data.tags,
          isEncrypted: result.data.isEncrypted,
          viewCount: result.data.metadata?.viewCount || 0,
          createdAt: result.data.createdAt,
          updatedAt: result.data.updatedAt,
        }
      };
    } catch (err) {
      logger.error('ViewNoteUseCase', 'Execution failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export class SearchNotesUseCase {
  async execute({ userId, query }) {
    try {
      if (!query || query.trim().length < 2) {
        return { success: false, error: 'Search query too short', code: 'QUERY_TOO_SHORT' };
      }

      const result = await noteRepository.search(userId, query.trim());
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const notes = result.data.map(n => ({
        id: n._id,
        title: n.title,
        category: n.category,
        tags: n.tags,
        isEncrypted: n.isEncrypted,
        preview: n.isEncrypted ? '🔒 Encrypted' : n.content.substring(0, 80) + '...',
        createdAt: n.createdAt,
      }));

      return { success: true, data: notes, count: result.count };
    } catch (err) {
      logger.error('SearchNotesUseCase', 'Execution failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export class UpdateNoteUseCase {
  async execute({ userId, noteId, updates }) {
    try {
      const existing = await noteRepository.findById(noteId, userId);
      if (!existing.success || !existing.data) {
        return { success: false, error: 'Note not found', code: 'NOT_FOUND' };
      }

      const merged = { ...existing.data.toObject(), ...updates };
      validateNoteInput({
        title: merged.title,
        content: merged.content,
        category: merged.category,
        tags: merged.tags
      });

      let finalContent = updates.content || existing.data.content;
      let isEncrypted = existing.data.isEncrypted;

      if (updates.content && existing.data.isEncrypted && cryptoService.enabled) {
        const result = cryptoService.encrypt(updates.content);
        if (result.success) {
          finalContent = result.encrypted;
        }
      }

      if (updates.encrypt === false) {
        isEncrypted = false;
        if (existing.data.isEncrypted && cryptoService.enabled) {
          const decrypted = cryptoService.decrypt(existing.data.content);
          if (decrypted.success) finalContent = decrypted.decrypted;
        }
      }

      const result = await noteRepository.update(noteId, userId, {
        title: updates.title || existing.data.title,
        content: finalContent,
        category: updates.category || existing.data.category,
        tags: updates.tags || existing.data.tags,
        isEncrypted: updates.encrypt !== undefined ? updates.encrypt : isEncrypted,
      });

      return result;
    } catch (err) {
      logger.error('UpdateNoteUseCase', 'Execution failed', { error: err.message });
      return { success: false, error: err.message, code: err.code };
    }
  }
}

export class DeleteNoteUseCase {
  async execute({ userId, noteId }) {
    try {
      const result = await noteRepository.delete(noteId, userId);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      if (!result.deleted) {
        return { success: false, error: 'Note not found', code: 'NOT_FOUND' };
      }
      return { success: true };
    } catch (err) {
      logger.error('DeleteNoteUseCase', 'Execution failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export class ListTagsUseCase {
  async execute({ userId }) {
    try {
      const result = await noteRepository.aggregateTags(userId);
      return result;
    } catch (err) {
      logger.error('ListTagsUseCase', 'Execution failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}
