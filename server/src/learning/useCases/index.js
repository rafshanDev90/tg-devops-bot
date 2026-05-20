import { LearningTopic } from '../models/LearningTopic.js';
import { logger } from '../../utils/logger.js';

const VALID_STATUSES = ['planned', 'in-progress', 'completed'];

export class CreateTopicUseCase {
  async execute({ userId, title, description = '', tags = [], resources = [] }) {
    if (!title || title.trim().length < 2) {
      return { success: false, error: 'Title must be at least 2 characters.' };
    }
    const existing = await LearningTopic.findOne({ userId, title: title.trim() });
    if (existing) {
      return { success: false, error: `Topic "${title.trim()}" already exists.` };
    }
    const topic = await LearningTopic.create({ userId, title: title.trim(), description, tags, resources });
    logger.info('CreateTopic', 'Topic created', { userId, title: topic.title });
    return { success: true, data: topic };
  }
}

export class UpdateTopicStatusUseCase {
  async execute({ userId, topicId, status }) {
    if (!VALID_STATUSES.includes(status)) {
      return { success: false, error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` };
    }
    const topic = await LearningTopic.findOneAndUpdate(
      { _id: topicId, userId },
      { status },
      { new: true }
    );
    if (!topic) return { success: false, error: 'Topic not found.' };
    logger.info('UpdateTopicStatus', 'Status updated', { userId, topicId, status });
    return { success: true, data: topic };
  }
}

export class ListRoadmapUseCase {
  async execute({ userId }) {
    const topics = await LearningTopic.find({ userId }).sort({ createdAt: -1 }).lean();
    const grouped = { planned: [], 'in-progress': [], completed: [] };
    for (const t of topics) grouped[t.status].push(t);
    return { success: true, data: grouped, total: topics.length };
  }
}

export class GetTopicUseCase {
  async execute({ userId, topicId }) {
    const topic = await LearningTopic.findOne({ _id: topicId, userId }).lean();
    if (!topic) return { success: false, error: 'Topic not found.' };
    return { success: true, data: topic };
  }
}

export class DeleteTopicUseCase {
  async execute({ userId, topicId }) {
    const result = await LearningTopic.deleteOne({ _id: topicId, userId });
    if (result.deletedCount === 0) return { success: false, error: 'Topic not found.' };
    logger.info('DeleteTopic', 'Topic deleted', { userId, topicId });
    return { success: true };
  }
}

export class EditTopicUseCase {
  async execute({ userId, topicId, updates }) {
    const topic = await LearningTopic.findOne({ _id: topicId, userId });
    if (!topic) return { success: false, error: 'Topic not found.' };

    if (updates.title !== undefined) {
      if (updates.title.trim().length < 2) {
        return { success: false, error: 'Title must be at least 2 characters.' };
      }
      const duplicate = await LearningTopic.findOne({ userId, title: updates.title.trim(), _id: { $ne: topicId } });
      if (duplicate) return { success: false, error: 'A topic with this title already exists.' };
      topic.title = updates.title.trim();
    }
    if (updates.description !== undefined) topic.description = updates.description;
    if (updates.tags !== undefined) topic.tags = updates.tags.map(t => t.trim().toLowerCase()).filter(Boolean);
    if (updates.resources !== undefined) topic.resources = updates.resources;

    await topic.save();
    logger.info('EditTopic', 'Topic updated', { userId, topicId });
    return { success: true, data: topic };
  }
}

export class AddResourceUseCase {
  async execute({ userId, topicId, url }) {
    const topic = await LearningTopic.findOneAndUpdate(
      { _id: topicId, userId },
      { $push: { resources: url } },
      { new: true }
    );
    if (!topic) return { success: false, error: 'Topic not found.' };
    logger.info('AddResource', 'Resource added', { userId, topicId, url });
    return { success: true, data: topic };
  }
}
