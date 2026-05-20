import {
  CreateTopicUseCase,
  UpdateTopicUseCase,
  ScheduleTopicUseCase,
  GetTopicUseCase,
  ListRoadmapUseCase,
  ListTodayTopicsUseCase,
  SearchTopicsUseCase,
  DeleteTopicUseCase,
  AddCodeSnippetUseCase,
  LinkNoteToTopicUseCase,
  GetTopicStatsUseCase,
} from '../useCases/index.js';
import { botSessionManager } from '../../bot/botSessionManager.js';

const createTopic = new CreateTopicUseCase();
const updateTopic = new UpdateTopicUseCase();
const scheduleTopic = new ScheduleTopicUseCase();
const getTopic = new GetTopicUseCase();
const listRoadmap = new ListRoadmapUseCase();
const listToday = new ListTodayTopicsUseCase();
const searchTopics = new SearchTopicsUseCase();
const deleteTopic = new DeleteTopicUseCase();
const addCodeSnippet = new AddCodeSnippetUseCase();
const linkNote = new LinkNoteToTopicUseCase();
const getStats = new GetTopicStatsUseCase();

const STATUS_EMOJI = { planned: '📋', 'in-progress': '🔄', completed: '✅', skipped: '⏭️' };
const PRIORITY_EMOJI = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };

export async function handleLearn(ctx) {
  const userId = ctx.from.id;
  const [roadmap, today, stats] = await Promise.all([
    listRoadmap.execute({ userId }),
    listToday.execute({ userId }),
    getStats.execute({ userId }),
  ]);

  const s = stats.data;
  const progress = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
  const bar = '█'.repeat(Math.round(progress / 10)) + '░'.repeat(10 - Math.round(progress / 10));

  const todayText = today.data.length > 0
    ? `\n\n📅 <b>Today's Plan:</b>\n${today.data.map(t => `  • ${STATUS_EMOJI[t.status]} ${escapeHtml(t.title)} — ${t.schedule.time || 'No time set'}`).join('\n')}`
    : '\n\n📅 <b>Today\'s Plan:</b>\n  No topics scheduled for today.';

  return ctx.reply(
    `🗺️ <b>Learning Dashboard</b>\n\n` +
    `Progress: ${bar} ${progress}%\n` +
    `📊 ${s.completed}/${s.total} completed | ${s.inProgress} in progress | ${s.planned} planned\n` +
    `⏱️ Est: ${Math.round(s.totalEstimatedMinutes / 60)}h | Actual: ${Math.round(s.totalActualMinutes / 60)}h` +
    todayText,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Add Topic', callback_data: 'learn_add_prompt' }],
          [
            { text: '📋 Roadmap', callback_data: 'learn_view' },
            { text: '🔍 Search', callback_data: 'learn_search_prompt' },
          ],
          [{ text: '📊 Stats', callback_data: 'learn_stats' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    }
  );
}

export async function handleLearnView(ctx) {
  const userId = ctx.from.id;
  const { data, total } = await listRoadmap.execute({ userId });

  if (total === 0) {
    return ctx.reply(
      '🗺️ <b>Learning Roadmap</b>\n\nNo topics yet.\n\nUse <code>/learn_add</code> to add one.',
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
      const lines = topics.slice(0, 8).map((t) => {
        const prio = PRIORITY_EMOJI[t.priority] || '';
        const sched = t.schedule?.date ? ` 📅 ${new Date(t.schedule.date).toLocaleDateString()}` : '';
        return `  • ${prio} ${escapeHtml(t.title)}${sched}`;
      }).join('\n');
      const more = topics.length > 8 ? `\n  <i>...and ${topics.length - 8} more</i>` : '';
      return `${header}\n${lines}${more}`;
    });

  return ctx.reply(
    `🗺️ <b>Learning Roadmap</b> (${total} topics)\n\n${sections.join('\n\n')}`,
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

export async function handleLearnAdd(ctx, args) {
  const title = Array.isArray(args) ? args.join(' ').trim() : String(args).trim();
  if (!title) {
    return ctx.reply('Usage: <code>/learn_add &lt;topic title&gt;</code>', { parse_mode: 'HTML' });
  }

  const result = await createTopic.execute({ userId: ctx.from.id, title });
  if (!result.success) return ctx.reply(`❌ ${result.error}`);

  return ctx.reply(
    `✅ Added: <b>${escapeHtml(result.data.title)}</b>\n📋 Status: Planned\n\n` +
    `Use <code>/learn_schedule ${result.data._id} YYYY-MM-DD HH:MM</code> to set a study time.`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnSchedule(ctx, args) {
  if (args.length < 1) {
    return ctx.reply(
      '📅 <b>Schedule a Topic</b>\n\n' +
      'Usage: <code>/learn_schedule &lt;topicId&gt; YYYY-MM-DD HH:MM [minutes]</code>\n\n' +
      'Example: <code>/learn_schedule 123abc 2024-05-20 14:00 90</code>',
      { parse_mode: 'HTML' }
    );
  }

  const [topicId, dateStr, timeStr, minutesStr] = args;
  const date = dateStr || new Date().toISOString().split('T')[0];
  const time = timeStr || '09:00';
  const minutes = parseInt(minutesStr) || 60;

  const result = await scheduleTopic.execute({
    userId: ctx.from.id,
    topicId,
    date,
    time,
    estimatedMinutes: minutes,
  });

  if (!result.success) return ctx.reply(`❌ ${result.error}`);

  return ctx.reply(
    `📅 Scheduled: <b>${escapeHtml(result.data.title)}</b>\n` +
    `📆 ${date} at ${time}\n` +
    `⏱️ Estimated: ${minutes} minutes`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnSearch(ctx, args) {
  const query = Array.isArray(args) ? args.join(' ').trim() : String(args).trim();
  if (!query) {
    return ctx.reply('🔍 <b>Search Topics</b>\n\nUsage: <code>/learn_search &lt;keyword&gt;</code>', { parse_mode: 'HTML' });
  }

  const result = await searchTopics.execute({ userId: ctx.from.id, query });
  if (!result.success) return ctx.reply(`❌ ${result.error}`);
  if (result.count === 0) return ctx.reply(`🔍 No topics found for "${escapeHtml(query)}".`);

  const lines = result.data.map((t, i) => {
    const prio = PRIORITY_EMOJI[t.priority] || '';
    const sched = t.schedule?.date ? ` 📅 ${new Date(t.schedule.date).toLocaleDateString()}` : '';
    return `${i + 1}. ${prio} ${STATUS_EMOJI[t.status]} <b>${escapeHtml(t.title)}</b>${sched}\n   <code>${t._id}</code>`;
  }).join('\n\n');

  return ctx.reply(
    `🔍 <b>Search Results</b> (${result.count})\n\n${lines}`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnStats(ctx) {
  const result = await getStats.execute({ userId: ctx.from.id });
  if (!result.success) return ctx.reply(`❌ ${result.error}`);

  const s = result.data;
  const progress = s.completionRate;
  const bar = '█'.repeat(Math.round(progress / 10)) + '░'.repeat(10 - Math.round(progress / 10));

  return ctx.reply(
    `📊 <b>Learning Statistics</b>\n\n` +
    `Progress: ${bar} ${progress}%\n\n` +
    `📋 Total Topics: ${s.total}\n` +
    `✅ Completed: ${s.completed}\n` +
    `🔄 In Progress: ${s.inProgress}\n` +
    `📝 Planned: ${s.planned}\n\n` +
    `⏱️ Estimated Time: ${Math.round(s.totalEstimatedMinutes / 60)}h\n` +
    `⏱️ Actual Time: ${Math.round(s.totalActualMinutes / 60)}h`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnViewDetail(ctx, topicId) {
  const result = await getTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  const t = result.data;
  const schedText = t.schedule?.date
    ? `\n📅 Scheduled: ${new Date(t.schedule.date).toLocaleDateString()} at ${t.schedule.time || 'N/A'}\n⏱️ Est: ${t.schedule.estimatedMinutes || 60}min`
    : '';
  const notesText = t.notes?.length
    ? `\n\n📝 Linked Notes (${t.notes.length}):\n${t.notes.map(n => `  • ${escapeHtml(n.title)}`).join('\n')}`
    : '';
  const codeText = t.codeSnippets?.length
    ? `\n\n💻 Code Snippets (${t.codeSnippets.length}):\n${t.codeSnippets.map((c, i) => `  ${i + 1}. ${escapeHtml(c.title)} (${c.language})`).join('\n')}`
    : '';
  const resourcesText = t.resources?.length
    ? `\n\n📎 Resources:\n${t.resources.map(r => `  • ${escapeHtml(r)}`).join('\n')}`
    : '';

  const text =
    `📌 <b>${escapeHtml(t.title)}</b>\n` +
    `${PRIORITY_EMOJI[t.priority] || ''} ${capitalize(t.priority)} priority\n` +
    `${STATUS_EMOJI[t.status]} ${capitalize(t.status)}\n` +
    `${t.description ? `\n${escapeHtml(t.description)}\n` : ''}` +
    `${schedText}${notesText}${codeText}${resourcesText}\n\n` +
    `<i>Created: ${new Date(t.createdAt).toLocaleDateString()}</i>` +
    `${t.completedAt ? `\n✅ Completed: ${new Date(t.completedAt).toLocaleDateString()}` : ''}`;

  await ctx.answerCbQuery();
  return ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✏️ Edit', callback_data: `learn_edit_${topicId}` },
          { text: '📅 Schedule', callback_data: `learn_schedule_${topicId}` },
        ],
        [
          { text: '💻 Add Code', callback_data: `learn_code_${topicId}` },
          { text: '📝 Add Note', callback_data: `learn_note_${topicId}` },
        ],
        [
          { text: '🗑️ Delete', callback_data: `learn_confirm_delete_${topicId}` },
          { text: '🔙 Back', callback_data: 'learn_view' },
        ],
      ],
    },
  });
}

export async function handleLearnStatusPicker(ctx, topicId) {
  const result = await getTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  const t = result.data;
  await ctx.answerCbQuery();
  return ctx.editMessageText(
    `📌 <b>${escapeHtml(t.title)}</b>\nCurrent: ${STATUS_EMOJI[t.status]} ${capitalize(t.status)}\n\nSet new status:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Planned', callback_data: `learn_set_${topicId}_planned` }],
          [{ text: '🔄 In Progress', callback_data: `learn_set_${topicId}_in-progress` }],
          [{ text: '✅ Completed', callback_data: `learn_set_${topicId}_completed` }],
          [{ text: '⏭️ Skipped', callback_data: `learn_set_${topicId}_skipped` }],
          [{ text: '🔙 Back', callback_data: `learn_detail_${topicId}` }],
        ],
      },
    }
  );
}

export async function handleLearnSetStatus(ctx, topicId, status) {
  const result = await updateTopic.execute({ userId: ctx.from.id, topicId, updates: { status } });
  if (!result.success) return ctx.answerCbQuery(`❌ ${result.error}`);

  await ctx.answerCbQuery(`${STATUS_EMOJI[status]} Updated!`);
  return ctx.editMessageText(
    `${STATUS_EMOJI[status]} <b>${escapeHtml(result.data.title)}</b> → <b>${capitalize(status)}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '📚 View Roadmap', callback_data: 'learn_view' }]],
      },
    }
  );
}

export async function handleLearnEditStart(ctx, topicId) {
  const result = await getTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  await ctx.answerCbQuery();
  botSessionManager.start(ctx.from.id, 'learn_edit', { topicId });

  return ctx.reply(
    `✏️ Editing: <b>${escapeHtml(result.data.title)}</b>\n\n` +
    `Send the new title:`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnDeleteConfirm(ctx, topicId) {
  await ctx.answerCbQuery();
  return ctx.editMessageText(
    `🗑️ <b>Delete this topic?</b>\n\nThis cannot be undone.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑️ Yes, Delete', callback_data: `learn_delete_${topicId}` }],
          [{ text: '❌ Cancel', callback_data: `learn_detail_${topicId}` }],
        ],
      },
    }
  );
}

export async function handleLearnDelete(ctx, topicId) {
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

export async function handleLearnCodePrompt(ctx, topicId) {
  const result = await getTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  await ctx.answerCbQuery();
  botSessionManager.start(ctx.from.id, 'learn_code', { topicId });

  return ctx.reply(
    `💻 <b>Add Code Snippet</b>\n\n` +
    `Topic: <b>${escapeHtml(result.data.title)}</b>\n\n` +
    `Send your code:\n` +
    `<pre>title: My First Snippet\n\`\`\`python\nprint("hello")\n\`\`\`</pre>`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnNotePrompt(ctx, topicId) {
  const result = await getTopic.execute({ userId: ctx.from.id, topicId });
  if (!result.success) return ctx.answerCbQuery(result.error);

  await ctx.answerCbQuery();
  botSessionManager.start(ctx.from.id, 'learn_note', { topicId });

  return ctx.reply(
    `📝 <b>Add Note to Topic</b>\n\n` +
    `Topic: <b>${escapeHtml(result.data.title)}</b>\n\n` +
    `Send your note (title and content separated by a blank line):`,
    { parse_mode: 'HTML' }
  );
}

export async function handleLearnSearchPrompt(ctx) {
  await ctx.answerCbQuery();
  botSessionManager.start(ctx.from.id, 'learn_search');
  return ctx.editMessageText(
    '🔍 <b>Search Topics</b>\n\nType a keyword to search:',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]] },
    }
  );
}

export async function handleLearnSchedulePrompt(ctx, topicId) {
  await ctx.answerCbQuery();
  botSessionManager.start(ctx.from.id, 'learn_schedule', { topicId });
  return ctx.reply(
    `📅 <b>Schedule Topic</b>\n\n` +
    `Send date and time:\n<code>YYYY-MM-DD HH:MM [minutes]</code>\n\n` +
    `Example: <code>2024-05-20 14:00 90</code>`,
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
