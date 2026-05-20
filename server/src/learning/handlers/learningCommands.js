import {
  CreateTopicUseCase,
  UpdateTopicStatusUseCase,
  ListRoadmapUseCase,
  GetTopicUseCase,
  DeleteTopicUseCase,
  EditTopicUseCase,
} from '../useCases/index.js';
import { botSessionManager } from '../../bot/botSessionManager.js';

const createTopic = new CreateTopicUseCase();
const updateStatus = new UpdateTopicStatusUseCase();
const listRoadmap = new ListRoadmapUseCase();
const getTopic = new GetTopicUseCase();
const deleteTopic = new DeleteTopicUseCase();
const editTopic = new EditTopicUseCase();

const STATUS_EMOJI = { planned: '📋', 'in-progress': '🔄', completed: '✅' };

export async function handleLearn(ctx) {
  const userId = ctx.from.id;
  const { data, total } = await listRoadmap.execute({ userId });

  if (total === 0) {
    return ctx.reply(
      '🗺️ <b>Learning Roadmap</b>\n\nNo topics yet.\n\nUse <code>/learn_add &lt;topic&gt;</code> to add one.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add Topic', callback_data: 'learn_add_prompt' }],
            [{ text: '🔙 Back', callback_data: 'menu_back' }],
          ],
        },
      }
    );
  }

  const sections = Object.entries(data)
    .filter(([, topics]) => topics.length > 0)
    .map(([status, topics]) => {
      const header = `${STATUS_EMOJI[status]} <b>${capitalize(status)}</b> (${topics.length})`;
      const lines = topics.map((t) => `  • ${escapeHtml(t.title)}`).join('\n');
      return `${header}\n${lines}`;
    });

  const progress = `\n\n📊 Progress: ${data.completed.length}/${total} completed (${total > 0 ? Math.round((data.completed.length / total) * 100) : 0}%)`;

  return ctx.reply(
    `🗺️ <b>Learning Roadmap</b>\n\n${sections.join('\n\n')}${progress}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Add Topic', callback_data: 'learn_add_prompt' }],
          [{ text: '🔄 Update Status', callback_data: 'learn_status_prompt' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    }
  );
}

export async function handleLearnAdd(ctx, args) {
  const title = Array.isArray(args) ? args.join(' ').trim() : String(args).trim();
  if (!title) {
    return ctx.reply('Usage: <code>/learn_add &lt;topic title&gt;</code>', { parse_mode: 'HTML' });
  }

  const result = await createTopic.execute({ userId: ctx.from.id, title });
  if (!result.success) return ctx.reply(`❌ ${result.error}`);

  return ctx.reply(
    `✅ Added: <b>${escapeHtml(result.data.title)}</b>\n📋 Status: Planned`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnStatus(ctx, args) {
  const userId = ctx.from.id;

  if (!args || args.length < 2) {
    const { data, total } = await listRoadmap.execute({ userId });
    if (total === 0) return ctx.reply('No topics found. Add one with <code>/learn_add</code>', { parse_mode: 'HTML' });

    const allTopics = [...data.planned, ...data['in-progress'], ...data.completed];
    const keyboard = allTopics.slice(0, 10).map((t) => ([{
      text: `${STATUS_EMOJI[t.status]} ${escapeHtml(t.title)}`,
      callback_data: `learn_pick_${t._id}`,
    }]));
    keyboard.push([{ text: '🔙 Back', callback_data: 'menu_learn' }]);

    return ctx.reply('Select a topic to update:', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  const [topicId, status] = args;
  const result = await updateStatus.execute({ userId, topicId, status });
  if (!result.success) return ctx.reply(`❌ ${result.error}`);

  return ctx.reply(
    `${STATUS_EMOJI[status]} <b>${escapeHtml(result.data.title)}</b> → ${capitalize(status)}`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnPickCallback(ctx, topicId) {
  const result = await getTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  const topic = result.data;
  await ctx.answerCbQuery();
  return ctx.editMessageText(
    `📌 <b>${escapeHtml(topic.title)}</b>\nCurrent: ${STATUS_EMOJI[topic.status]} ${capitalize(topic.status)}\n\nSet new status:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Planned', callback_data: `learn_set_${topicId}_planned` }],
          [{ text: '🔄 In Progress', callback_data: `learn_set_${topicId}_in-progress` }],
          [{ text: '✅ Completed', callback_data: `learn_set_${topicId}_completed` }],
          [{ text: '📝 Edit', callback_data: `learn_edit_${topicId}` }],
          [{ text: '🗑️ Delete', callback_data: `learn_confirm_delete_${topicId}` }],
          [{ text: '🔙 Back', callback_data: 'menu_learn' }],
        ],
      },
    }
  );
}

export async function handleLearnSetCallback(ctx, topicId, status) {
  const result = await updateStatus.execute({ userId: ctx.from.id, topicId, status });
  if (!result.success) return ctx.answerCbQuery(`❌ ${result.error}`);

  await ctx.answerCbQuery(`${STATUS_EMOJI[status]} Updated!`);
  return ctx.editMessageText(
    `${STATUS_EMOJI[status]} <b>${escapeHtml(result.data.title)}</b> marked as <b>${capitalize(status)}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📚 View Roadmap', callback_data: 'learn_view' }]] },
    }
  );
}

export async function handleLearnEditCallback(ctx, topicId) {
  const result = await getTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  await ctx.answerCbQuery();
  botSessionManager.start(ctx.from.id, 'learn_edit', { topicId });

  return ctx.reply(
    `✏️ Editing: <b>${escapeHtml(result.data.title)}</b>\n\nSend the new title:`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnDeleteCallback(ctx, topicId) {
  await ctx.answerCbQuery();
  return ctx.editMessageText(
    `🗑️ <b>Delete this topic?</b>\n\nThis cannot be undone.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑️ Yes, Delete', callback_data: `learn_delete_${topicId}` }],
          [{ text: '❌ Cancel', callback_data: `learn_pick_${topicId}` }],
        ],
      },
    }
  );
}

export async function handleLearnDeleteConfirm(ctx, topicId) {
  const result = await deleteTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  await ctx.answerCbQuery('🗑️ Deleted!');
  return ctx.editMessageText(
    `✅ Topic deleted.`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📚 View Roadmap', callback_data: 'learn_view' }]] },
    }
  );
}

export async function handleLearnDetailCallback(ctx, topicId) {
  const result = await getTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  const topic = result.data;
  const tagsText = topic.tags.length ? `\n🏷️ ${topic.tags.join(', ')}` : '';
  const resourcesText = topic.resources.length
    ? `\n📎 Resources:\n${topic.resources.map(r => `  • ${escapeHtml(r)}`).join('\n')}`
    : '';

  await ctx.answerCbQuery();
  return ctx.reply(
    `📌 <b>${escapeHtml(topic.title)}</b>\n` +
    `${STATUS_EMOJI[topic.status]} ${capitalize(topic.status)}\n` +
    `${topic.description ? `\n${escapeHtml(topic.description)}\n` : ''}` +
    `${tagsText}${resourcesText}\n\n` +
    `<i>Created: ${topic.createdAt.toLocaleDateString()}</i>`,
    { parse_mode: 'HTML' }
  );
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
