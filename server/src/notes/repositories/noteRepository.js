import { Note } from '../models/Note.js';
import { logger } from '../../utils/logger.js';

export class NoteRepository {
  async create(noteData) {
    try {
      const note = await Note.create(noteData);
      return { success: true, data: note };
    } catch (err) {
      logger.error('NoteRepository', 'Create failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async findById(id, userId) {
    try {
      const note = await Note.findOne({ _id: id, userId });
      return { success: true, data: note };
    } catch (err) {
      logger.error('NoteRepository', 'FindById failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async findByUser(userId, { category, tag, page = 1, limit = 10 } = {}) {
    try {
      const query = { userId };
      if (category) query.category = category;
      if (tag) query.tags = tag;

      const skip = (page - 1) * limit;
      const [notes, total] = await Promise.all([
        Note.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Note.countDocuments(query)
      ]);

      return {
        success: true,
        data: notes,
        total,
        page,
        hasMore: skip + notes.length < total
      };
    } catch (err) {
      logger.error('NoteRepository', 'FindByUser failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async update(id, userId, updates) {
    try {
      const note = await Note.findOneAndUpdate(
        { _id: id, userId },
        { ...updates, updatedAt: new Date() },
        { new: true }
      );
      return { success: true, data: note };
    } catch (err) {
      logger.error('NoteRepository', 'Update failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async delete(id, userId) {
    try {
      const result = await Note.deleteOne({ _id: id, userId });
      return { success: true, deleted: result.deletedCount > 0 };
    } catch (err) {
      logger.error('NoteRepository', 'Delete failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async search(userId, query) {
    try {
      const notes = await Note.find(
        { userId, $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } }).limit(20).lean();

      return { success: true, data: notes, count: notes.length };
    } catch (err) {
      logger.error('NoteRepository', 'Search failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async aggregateTags(userId) {
    try {
      const tags = await Note.aggregate([
        { $match: { userId } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 }
      ]);

      return { success: true, data: tags.map(t => ({ tag: t._id, count: t.count })) };
    } catch (err) {
      logger.error('NoteRepository', 'AggregateTags failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async trackView(id) {
    try {
      await Note.findByIdAndUpdate(id, {
        $inc: { 'metadata.viewCount': 1 },
        'metadata.lastViewedAt': new Date()
      });
    } catch (err) {
      logger.error('NoteRepository', 'TrackView failed', { error: err.message });
    }
  }
}

export const noteRepository = new NoteRepository();
