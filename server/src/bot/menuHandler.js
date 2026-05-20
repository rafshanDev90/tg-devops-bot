import { MenuBuilder } from './menuBuilder.js';
import { Student } from '../models/Student.js';
import { requireAdmin } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';
import { botSessionManager } from './botSessionManager.js';

export async function handleMenuCallback(ctx) {
  const data = ctx.callbackQuery.data;

  // Dynamic learning callbacks
  if (data.startsWith('learn_detail_')) {
    const topicId = data.replace('learn_detail_', '');
    const { handleLearnViewDetail } = await import('../learning/handlers/learningCommands.js');
    return handleLearnViewDetail(ctx, topicId);
  }
  if (data.startsWith('learn_set_')) {
    const match = data.match(/^learn_set_(.+?)_(planned|in-progress|completed|skipped)$/);
    if (match) {
      const { handleLearnSetStatus } = await import('../learning/handlers/learningCommands.js');
      return handleLearnSetStatus(ctx, match[1], match[2]);
    }
  }
  if (data.startsWith('learn_edit_')) {
    const topicId = data.replace('learn_edit_', '');
    const { handleLearnEditStart } = await import('../learning/handlers/learningCommands.js');
    return handleLearnEditStart(ctx, topicId);
  }
  if (data.startsWith('learn_confirm_delete_')) {
    const topicId = data.replace('learn_confirm_delete_', '');
    const { handleLearnDeleteConfirm } = await import('../learning/handlers/learningCommands.js');
    return handleLearnDeleteConfirm(ctx, topicId);
  }
  if (data.startsWith('learn_delete_')) {
    const topicId = data.replace('learn_delete_', '');
    const { handleLearnDelete } = await import('../learning/handlers/learningCommands.js');
    return handleLearnDelete(ctx, topicId);
  }
  if (data.startsWith('learn_code_')) {
    const topicId = data.replace('learn_code_', '');
    const { handleLearnCodePrompt } = await import('../learning/handlers/learningCommands.js');
    return handleLearnCodePrompt(ctx, topicId);
  }
  if (data.startsWith('learn_note_')) {
    const topicId = data.replace('learn_note_', '');
    const { handleLearnNotePrompt } = await import('../learning/handlers/learningCommands.js');
    return handleLearnNotePrompt(ctx, topicId);
  }
  if (data.startsWith('learn_schedule_')) {
    const topicId = data.replace('learn_schedule_', '');
    const { handleLearnSchedulePrompt } = await import('../learning/handlers/learningCommands.js');
    return handleLearnSchedulePrompt(ctx, topicId);
  }
  if (data.startsWith('learn_pick_')) {
    const topicId = data.replace('learn_pick_', '');
    const { handleLearnViewDetail } = await import('../learning/handlers/learningCommands.js');
    return handleLearnViewDetail(ctx, topicId);
  }

  switch (data) {
    case 'menu_back':
      return ctx.editMessageText(MenuBuilder.mainMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.mainMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_study':
      return ctx.editMessageText(MenuBuilder.studyMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.studyMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_routine':
      return ctx.editMessageText(MenuBuilder.routineMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.routineMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_notes':
      return ctx.editMessageText(MenuBuilder.notesMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.notesMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_profile':
      return handleProfileMenu(ctx);

    case 'menu_status':
      return handleStatusAction(ctx);

    case 'study_ask':
      await ctx.answerCbQuery();
      botSessionManager.start(ctx.from.id, 'study_ask');
      return ctx.editMessageText(
        '💬 <b>Ask AI</b>\n\nType your question and send it:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]],
          },
        }
      );

    case 'study_search':
      await ctx.answerCbQuery();
      botSessionManager.start(ctx.from.id, 'study_search');
      return ctx.editMessageText(
        '🌐 <b>Web Search</b>\n\nType your search query:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]],
          },
        }
      );

    case 'study_assign':
      return ctx.answerCbQuery('Loading assignments...').then(async () => {
        const { handleAssignments } = await import('./handlers.js');
        return handleAssignments(ctx);
      });

    case 'routine_today':
      return ctx.answerCbQuery('Loading today\'s classes...').then(async () => {
        const { handleToday } = await import('./handlers.js');
        return handleToday(ctx);
      });

    case 'routine_week':
      return ctx.answerCbQuery('Loading weekly routine...').then(async () => {
        const { handleRoutine } = await import('./handlers.js');
        return handleRoutine(ctx);
      });

    case 'routine_upload':
      await ctx.answerCbQuery();
      botSessionManager.start(ctx.from.id, 'routine_upload');
      return ctx.editMessageText(
        '📤 <b>Upload Routine</b>\n\nSend your routine as:\n• 📷 A photo of your timetable\n• 📄 A <code>.txt</code> file\n• ✏️ Paste the text directly\n\nJust send it now:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]],
          },
        }
      );

    case 'routine_clear':
      return ctx.answerCbQuery('Clearing routine...').then(async () => {
        const { handleClearRoutine } = await import('./handlers.js');
        return handleClearRoutine(ctx);
      });

    case 'notes_add':
      return ctx.answerCbQuery('Starting note creation...').then(async () => {
        const { handleAddNote } = await import('../notes/handlers/noteCommands.js');
        return handleAddNote(ctx);
      });

    case 'notes_list':
      return ctx.answerCbQuery('Loading notes...').then(async () => {
        const { handleListNotes } = await import('../notes/handlers/noteCommands.js');
        return handleListNotes(ctx);
      });

    case 'notes_search':
      await ctx.answerCbQuery();
      botSessionManager.start(ctx.from.id, 'notes_search');
      return ctx.editMessageText(
        '🔍 <b>Search Notes</b>\n\nType a keyword to search:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]],
          },
        }
      );

    case 'notes_tags':
      return ctx.answerCbQuery('Loading tags...').then(async () => {
        const { handleListTags } = await import('../notes/handlers/noteCommands.js');
        return handleListTags(ctx);
      });

    case 'notes_cancel':
      return ctx.answerCbQuery('Creation cancelled.').then(async () => {
        const { noteSessionManager } = await import('../notes/managers/sessionManager.js');
        noteSessionManager.cancelSession(ctx.from.id);
        return ctx.editMessageText('❌ Note creation cancelled.');
      });

    case 'profile_edit':
      await ctx.answerCbQuery();
      botSessionManager.start(ctx.from.id, 'profile_edit');
      return ctx.editMessageText(
        '✏️ <b>Edit Profile</b>\n\nWhat would you like to update?\n\nType in this format:\n<code>field: value</code>\n\nFields: <code>name</code>, <code>university_id</code>',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]],
          },
        }
      );

    case 'profile_stats':
      return ctx.answerCbQuery('Loading stats...').then(async () => {
        const { handleProfileStats } = await import('./handlers.js');
        return handleProfileStats(ctx);
      });

    case 'admin_dashboard':
      return handleAdminAction(ctx, 'dashboard');

    case 'admin_users':
      return handleAdminAction(ctx, 'users');

    case 'admin_broadcast':
      return handleAdminAction(ctx, 'broadcast');

    case 'admin_stats':
      return handleAdminAction(ctx, 'stats');

    case 'session_cancel':
      await ctx.answerCbQuery('Cancelled.');
      botSessionManager.end(ctx.from.id);
      return ctx.editMessageText(MenuBuilder.mainMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.mainMenu().reply_markup,
      });

    case 'menu_learn':
      return ctx.editMessageText(MenuBuilder.learningMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.learningMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_run':
      return ctx.editMessageText(MenuBuilder.runMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.runMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'learn_view': {
      await ctx.answerCbQuery();
      const { handleLearnView } = await import('../learning/handlers/learningCommands.js');
      return handleLearnView(ctx);
    }

    case 'learn_today': {
      await ctx.answerCbQuery();
      const { ListTodayTopicsUseCase } = await import('../learning/useCases/index.js');
      const listToday = new ListTodayTopicsUseCase();
      const result = await listToday.execute({ userId: ctx.from.id });
      if (!result.data.length) {
        return ctx.editMessageText('📅 <b>Today\'s Plan</b>\n\nNo topics scheduled for today.', {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_learn' }]] },
        });
      }
      const STATUS_EMOJI = { planned: '📋', 'in-progress': '🔄', completed: '✅', skipped: '⏭️' };
      const lines = result.data.map(t => `  • ${STATUS_EMOJI[t.status]} ${escapeHtml(t.title)} — ${t.schedule.time || 'No time'}`).join('\n');
      return ctx.editMessageText(`📅 <b>Today's Plan</b>\n\n${lines}`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_learn' }]] },
      });
    }

    case 'learn_stats': {
      await ctx.answerCbQuery();
      const { handleLearnStats } = await import('../learning/handlers/learningCommands.js');
      return handleLearnStats(ctx);
    }

    case 'learn_search_prompt':
      return (await import('../learning/handlers/learningCommands.js')).handleLearnSearchPrompt(ctx);

    case 'learn_add_prompt':
      await ctx.answerCbQuery();
      botSessionManager.start(ctx.from.id, 'learn_add');
      return ctx.editMessageText(
        '➕ <b>Add Topic</b>\n\nType the topic title and send it:\n<i>e.g. PyTorch Tensors</i>',
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]] },
        }
      );

    case 'learn_status_prompt': {
      await ctx.answerCbQuery();
      const { handleLearnView } = await import('../learning/handlers/learningCommands.js');
      return handleLearnView(ctx);
    }

    case 'run_prompt':
      await ctx.answerCbQuery();
      botSessionManager.start(ctx.from.id, 'run_code');
      return ctx.editMessageText(
        '💻 <b>Python Lab</b>\n\nSend your Python code now:\n\n<pre>import torch\nprint(torch.__version__)</pre>',
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]] },
        }
      );

    default:
      return ctx.answerCbQuery();
  }
}

async function handleProfileMenu(ctx) {
  await ctx.answerCbQuery();
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student) {
    return ctx.reply('⚠️ Please use /setup_profile first.');
  }
  return ctx.editMessageText(MenuBuilder.profileMenu(student).text, {
    parse_mode: 'HTML',
    reply_markup: MenuBuilder.profileMenu(student).reply_markup,
  });
}

async function handleStatusAction(ctx) {
  await ctx.answerCbQuery();
  const mongoose = await import('mongoose');
  const mongoState = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  return ctx.editMessageText(
    `ℹ️ <b>System Status</b>\n\n` +
    `Bot: ✅ Running\n` +
    `MongoDB: ${mongoState === 'Connected' ? '✅' : '❌'} ${mongoState}\n` +
    `Uptime: ${formatUptime(process.uptime())}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_back' }]],
      },
    }
  );
}

async function handleAdminAction(ctx, action) {
  await ctx.answerCbQuery();
  try {
    await requireAdmin(ctx, async () => {
      const {
        _handleAdmin: handleAdmin,
        _handleAdminUsers: handleAdminUsers,
        _handleAdminBroadcast: handleAdminBroadcast,
        _handleAdminStats: handleAdminStats,
      } = await import('./handlers.js');

      const actions = {
        dashboard: handleAdmin,
        users: handleAdminUsers,
        broadcast: handleAdminBroadcast,
        stats: handleAdminStats,
      };

      const handler = actions[action];
      if (handler) {
        await handler(ctx, () => {});
      }
    });
  } catch {
    // requireAdmin already replied
  }
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Handles free-text input for sessions started from menu buttons
export async function handleBotSession(ctx) {
  const telegramId = ctx.from.id;
  const session = botSessionManager.get(telegramId);
  if (!session) return false;

  const text = ctx.message?.text?.trim();

  switch (session.type) {
    case 'study_ask': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send a text question.');
      const { handleAsk } = await import('./handlers.js');
      ctx.message.text = `/ask ${text}`;
      await handleAsk(ctx);
      return true;
    }

    case 'study_search': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send a search query.');
      const { handleSearch } = await import('./handlers.js');
      await handleSearch(ctx, text.split(' '));
      return true;
    }

    case 'notes_search': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send a keyword.');
      const { handleNotesSearch } = await import('./handlers.js');
      await handleNotesSearch(ctx, [text]);
      return true;
    }

    case 'profile_edit': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send the field and value.');
      const { handleProfileEdit } = await import('./handlers.js');
      await handleProfileEdit(ctx, text.split(' '));
      return true;
    }

    case 'routine_upload': {
      botSessionManager.end(telegramId);
      // Delegate to the existing upload handler — it already handles text, photo, and document
      const { handleUploadRoutine } = await import('./handlers.js');
      await handleUploadRoutine(ctx);
      return true;
    }

    case 'learn_add': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send a topic title.');
      const { handleLearnAdd } = await import('../learning/handlers/learningCommands.js');
      await handleLearnAdd(ctx, text.split(' '));
      return true;
    }

    case 'learn_edit': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send a new title.');
      const { UpdateTopicUseCase } = await import('../learning/useCases/index.js');
      const edit = new UpdateTopicUseCase();
      const result = await edit.execute({ userId: telegramId, topicId: session.data.topicId, updates: { title: text } });
      if (!result.success) return ctx.reply(`❌ ${result.error}`);
      await ctx.reply(`✅ Title updated to: <b>${escapeHtml(result.data.title)}</b>`, { parse_mode: 'HTML' });
      return true;
    }

    case 'learn_search': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send a search query.');
      const { handleLearnSearch } = await import('../learning/handlers/learningCommands.js');
      await handleLearnSearch(ctx, text.split(' '));
      return true;
    }

    case 'learn_schedule': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send date and time.');
      const { handleLearnSchedule } = await import('../learning/handlers/learningCommands.js');
      await handleLearnSchedule(ctx, [session.data.topicId, ...text.split(' ')]);
      return true;
    }

    case 'learn_code': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send your code.');
      const { AddCodeSnippetUseCase } = await import('../learning/useCases/index.js');
      const addSnippet = new AddCodeSnippetUseCase();
      const codeMatch = text.match(/title:\s*(.+?)\n?```(\w+)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        const result = await addSnippet.execute({
          userId: telegramId,
          topicId: session.data.topicId,
          title: codeMatch[1].trim(),
          code: codeMatch[3].trim(),
          language: codeMatch[2] || 'python',
        });
        if (!result.success) return ctx.reply(`❌ ${result.error}`);
        return ctx.reply(`✅ Code snippet "${escapeHtml(codeMatch[1].trim())}" added!`);
      }
      const result = await addSnippet.execute({
        userId: telegramId,
        topicId: session.data.topicId,
        title: 'Snippet',
        code: text,
        language: 'python',
      });
      if (!result.success) return ctx.reply(`❌ ${result.error}`);
      return ctx.reply('✅ Code snippet added!');
    }

    case 'learn_note': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send your note.');
      const { CreateNoteUseCase, LinkNoteToTopicUseCase } = await import('../notes/useCases/index.js');
      const createNote = new CreateNoteUseCase();
      const link = new LinkNoteToTopicUseCase();
      const parts = text.split('\n\n');
      const noteTitle = parts[0] || 'Learning Note';
      const noteContent = parts.slice(1).join('\n\n') || text;
      const noteResult = await createNote.execute({
        userId: telegramId,
        title: noteTitle,
        content: noteContent,
        category: 'learning',
      });
      if (!noteResult.success) return ctx.reply(`❌ ${noteResult.error}`);
      await link.execute({ userId: telegramId, topicId: session.data.topicId, noteId: noteResult.data._id });
      return ctx.reply(`✅ Note linked to topic!`);
    }

    case 'run_code': {
      botSessionManager.end(telegramId);
      if (!text) return ctx.reply('⚠️ Please send your code.');
      const { handleRun } = await import('./runHandler.js');
      // Inject text so handleRun can extract code from it
      ctx.message.text = text;
      await handleRun(ctx);
      return true;
    }

    default:
      botSessionManager.end(telegramId);
      return false;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
