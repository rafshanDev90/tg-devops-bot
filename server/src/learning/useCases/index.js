import { LearningTopic } from '../models/LearningTopic.js';
import { Note } from '../../notes/models/Note.js';
import { logger } from '../../utils/logger.js';

const VALID_STATUSES = ['planned', 'in-progress', 'completed', 'skipped'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

export class CreateTopicUseCase {
  async execute({ userId, title, description = '', tags = [], resources = [], priority = 'medium', scheduleDate = null, scheduleTime = null, estimatedMinutes = 60 }) {
    if (!title || title.trim().length < 2) {
      return { success: false, error: 'Title must be at least 2 characters.' };
    }
    const existing = await LearningTopic.findOne({ userId, title: title.trim() });
    if (existing) {
      return { success: false, error: `Topic "${title.trim()}" already exists.` };
    }

    const schedule = {};
    if (scheduleDate) {
      schedule.date = new Date(scheduleDate);
      schedule.time = scheduleTime || '09:00';
      schedule.estimatedMinutes = estimatedMinutes;
      schedule.reminderEnabled = true;
    }

    const topic = await LearningTopic.create({
      userId,
      title: title.trim(),
      description,
      tags,
      resources,
      priority,
      schedule: Object.keys(schedule).length > 0 ? schedule : undefined,
    });

    logger.info('CreateTopic', 'Topic created', { userId, title: topic.title, scheduled: !!schedule.date });
    return { success: true, data: topic };
  }
}

export class UpdateTopicUseCase {
  async execute({ userId, topicId, updates }) {
    const topic = await LearningTopic.findOne({ _id: topicId, userId });
    if (!topic) return { success: false, error: 'Topic not found.' };

    if (updates.title !== undefined) {
      if (updates.title.trim().length < 2) return { success: false, error: 'Title must be at least 2 characters.' };
      const dup = await LearningTopic.findOne({ userId, title: updates.title.trim(), _id: { $ne: topicId } });
      if (dup) return { success: false, error: 'A topic with this title already exists.' };
      topic.title = updates.title.trim();
    }
    if (updates.description !== undefined) topic.description = updates.description;
    if (updates.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(updates.priority)) return { success: false, error: 'Invalid priority.' };
      topic.priority = updates.priority;
    }
    if (updates.tags !== undefined) topic.tags = updates.tags.map(t => t.trim().toLowerCase()).filter(Boolean);
    if (updates.resources !== undefined) topic.resources = updates.resources;

    if (updates.scheduleDate !== undefined) {
      topic.schedule = topic.schedule || {};
      topic.schedule.date = updates.scheduleDate ? new Date(updates.scheduleDate) : undefined;
      if (updates.scheduleTime) topic.schedule.time = updates.scheduleTime;
      if (updates.estimatedMinutes) topic.schedule.estimatedMinutes = updates.estimatedMinutes;
    }

    if (updates.status !== undefined) {
      if (!VALID_STATUSES.includes(updates.status)) return { success: false, error: 'Invalid status.' };
      topic.status = updates.status;
      if (updates.status === 'completed' && topic.status !== 'completed') {
        topic.completedAt = new Date();
      }
    }

    await topic.save();
    logger.info('UpdateTopic', 'Topic updated', { userId, topicId });
    return { success: true, data: topic };
  }
}

export class ScheduleTopicUseCase {
  async execute({ userId, topicId, date, time, estimatedMinutes = 60 }) {
    const topic = await LearningTopic.findOne({ _id: topicId, userId });
    if (!topic) return { success: false, error: 'Topic not found.' };

    topic.schedule = {
      ...topic.schedule,
      date: new Date(date),
      time: time || '09:00',
      estimatedMinutes,
      reminderEnabled: true,
    };

    await topic.save();
    logger.info('ScheduleTopic', 'Topic scheduled', { userId, topicId, date, time });
    return { success: true, data: topic };
  }
}

export class GetTopicUseCase {
  async execute({ userId, topicId }) {
    const topic = await LearningTopic.findOne({ _id: topicId, userId })
      .populate('notes', 'title category tags createdAt')
      .populate('parentTopic', 'title status')
      .lean();
    if (!topic) return { success: false, error: 'Topic not found.' };
    return { success: true, data: topic };
  }
}

export class ListRoadmapUseCase {
  async execute({ userId }) {
    const topics = await LearningTopic.find({ userId }).sort({ createdAt: -1 }).lean();
    const grouped = { planned: [], 'in-progress': [], completed: [], skipped: [] };
    for (const t of topics) grouped[t.status].push(t);
    return { success: true, data: grouped, total: topics.length };
  }
}

export class ListTodayTopicsUseCase {
  async execute({ userId }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const topics = await LearningTopic.find({
      userId,
      'schedule.date': { $gte: today, $lt: tomorrow }
    }).sort({ 'schedule.time': 1 }).lean();

    return { success: true, data: topics, count: topics.length };
  }
}

export class SearchTopicsUseCase {
  async execute({ userId, query }) {
    if (!query || query.trim().length < 2) {
      return { success: false, error: 'Search query too short.' };
    }
    const topics = await LearningTopic.find(
      { userId, $text: { $search: query.trim() } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).limit(20).lean();

    return { success: true, data: topics, count: topics.length };
  }
}

export class DeleteTopicUseCase {
  async execute({ userId, topicId }) {
    const result = await LearningTopic.deleteOne({ _id: topicId, userId });
    if (result.deletedCount === 0) return { success: false, error: 'Topic not found.' };
    await Note.updateMany({ topicId }, { $unset: { topicId: 1 } });
    logger.info('DeleteTopic', 'Topic deleted', { userId, topicId });
    return { success: true };
  }
}

export class AddCodeSnippetUseCase {
  async execute({ userId, topicId, title, code, language = 'python' }) {
    const topic = await LearningTopic.findOneAndUpdate(
      { _id: topicId, userId },
      { $push: { codeSnippets: { title, code, language, createdAt: new Date() } } },
      { new: true }
    );
    if (!topic) return { success: false, error: 'Topic not found.' };
    logger.info('AddCodeSnippet', 'Snippet added', { userId, topicId, title });
    return { success: true, data: topic };
  }
}

export class LinkNoteToTopicUseCase {
  async execute({ userId, topicId, noteId }) {
    const [topic, note] = await Promise.all([
      LearningTopic.findOne({ _id: topicId, userId }),
      Note.findOne({ _id: noteId, userId })
    ]);
    if (!topic) return { success: false, error: 'Topic not found.' };
    if (!note) return { success: false, error: 'Note not found.' };

    if (!topic.notes.includes(noteId)) {
      topic.notes.push(noteId);
      await topic.save();
    }

    note.topicId = topicId;
    note.category = 'learning';
    await note.save();

    logger.info('LinkNoteToTopic', 'Note linked', { userId, topicId, noteId });
    return { success: true, data: topic };
  }
}

export class GetTopicStatsUseCase {
  async execute({ userId }) {
    const stats = await LearningTopic.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
          planned: { $sum: { $cond: [{ $eq: ['$status', 'planned'] }, 1, 0] } },
          totalEstimatedMinutes: { $sum: '$schedule.estimatedMinutes' },
          totalActualMinutes: { $sum: '$schedule.actualMinutes' },
        }
      }
    ]);

    const s = stats[0] || { total: 0, completed: 0, inProgress: 0, planned: 0, totalEstimatedMinutes: 0, totalActualMinutes: 0 };
    return {
      success: true,
      data: {
        ...s,
        completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }
    };
  }
}
