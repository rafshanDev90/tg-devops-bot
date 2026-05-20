import { MenuBuilder } from './menuBuilder.js';
import { Student } from '../models/Student.js';
import { requireAdmin } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';
import { botSessionManager } from './botSessionManager.js';
import { multiLineSessionManager } from './multiLineSessionManager.js';
import { escapeHtml } from '../utils/html.js';
import { safeEdit } from '../utils/safeEdit.js';

export function multiLineKeyboard(submitLabel = 'Submit', clearLabel = 'Clear') {
  return {
    inline_keyboard: [
      [{ text: `✅ ${submitLabel}`, callback_data: 'multiline_submit' }],
      [
        { text: `🗑 ${clearLabel}`, callback_data: 'multiline_clear' },
        { text: '❌ Cancel', callback_data: 'multiline_cancel' },
      ],
    ],
  };
}

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
    multiLineSessionManager.start(ctx.from.id, 'learn_code', 'Add Code Snippet', 'Add Code');
    multiLineSessionManager.get(ctx.from.id).data = { topicId };
    return safeEdit(ctx,
      '💻 <b>Add Code Snippet</b>\n\nType your code. Each message is appended.\n\nPress ✅ Add Code when ready.',
      { parse_mode: 'HTML', reply_markup: multiLineKeyboard('Add Code') }
    );
  }
  if (data.startsWith('learn_note_')) {
    const topicId = data.replace('learn_note_', '');
    multiLineSessionManager.start(ctx.from.id, 'learn_note', 'Add Note', 'Add Note');
    multiLineSessionManager.get(ctx.from.id).data = { topicId };
    return safeEdit(ctx,
      '📝 <b>Add Note</b>\n\nType your note. First line = title, rest = content.\n\nPress ✅ Add Note when ready.',
      { parse_mode: 'HTML', reply_markup: multiLineKeyboard('Add Note') }
    );
  }
  if (data.startsWith('learn_schedule_')) {
    const topicId = data.replace('learn_schedule_', '');
    multiLineSessionManager.start(ctx.from.id, 'learn_schedule', 'Schedule Topic', 'Schedule');
    multiLineSessionManager.get(ctx.from.id).data = { topicId };
    return safeEdit(ctx,
      '📅 <b>Schedule Topic</b>\n\nType date and time (e.g. 2026-05-25 14:00).\n\nPress ✅ Schedule when ready.',
      { parse_mode: 'HTML', reply_markup: multiLineKeyboard('Schedule') }
    );
  }
  if (data.startsWith('learn_pick_')) {
    const topicId = data.replace('learn_pick_', '');
    const { handleLearnViewDetail } = await import('../learning/handlers/learningCommands.js');
    return handleLearnViewDetail(ctx, topicId);
  }

  switch (data) {
    case 'menu_back':
      return safeEdit(ctx,MenuBuilder.mainMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.mainMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_study':
      return safeEdit(ctx,MenuBuilder.studyMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.studyMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    // case 'menu_routine':
    //   return ctx.editMessageText(MenuBuilder.routineMenu().text, {
    //     parse_mode: 'HTML',
    //     reply_markup: MenuBuilder.routineMenu().reply_markup,
    //   }).then(() => ctx.answerCbQuery());

    // case 'menu_notes':
    //   return ctx.editMessageText(MenuBuilder.notesMenu().text, {
    //     parse_mode: 'HTML',
    //     reply_markup: MenuBuilder.notesMenu().reply_markup,
    //   }).then(() => ctx.answerCbQuery());

    case 'menu_profile':
      return handleProfileMenu(ctx);

    case 'menu_status':
      return handleStatusAction(ctx);

    case 'study_ask':
      multiLineSessionManager.start(ctx.from.id, 'study_ask', 'Ask AI', 'Send');
      return safeEdit(ctx,
        '💬 <b>Ask AI</b>\n\nType your question. Each message is appended.\n\nPress ✅ Send when ready.',
        { parse_mode: 'HTML', reply_markup: multiLineKeyboard('Send') }
      );

    case 'study_search':
      multiLineSessionManager.start(ctx.from.id, 'study_search', 'Web Search', 'Search');
      return safeEdit(ctx,
        '🌐 <b>Web Search</b>\n\nType your query. Each message is appended.\n\nPress ✅ Search when ready.',
        { parse_mode: 'HTML', reply_markup: multiLineKeyboard('Search') }
      );

    case 'study_assign':
      return ctx.answerCbQuery('Loading assignments...').then(async () => {
        const { handleAssignments } = await import('./handlers.js');
        return handleAssignments(ctx);
      });

    // case 'routine_today':
    //   return ctx.answerCbQuery('Loading today\'s classes...').then(async () => {
    //     const { handleToday } = await import('./handlers.js');
    //     return handleToday(ctx);
    //   });

    // case 'routine_week':
    //   return ctx.answerCbQuery('Loading weekly routine...').then(async () => {
    //     const { handleRoutine } = await import('./handlers.js');
    //     return handleRoutine(ctx);
    //   });

    // case 'routine_upload':
    //   await ctx.answerCbQuery();
    //   botSessionManager.start(ctx.from.id, 'routine_upload');
    //   return ctx.editMessageText(
    //     '📤 <b>Upload Routine</b>\n\nSend your routine as:\n• 📷 A photo of your timetable\n• 📄 A <code>.txt</code> file\n• ✏️ Paste the text directly\n\nJust send it now:',
    //     {
    //       parse_mode: 'HTML',
    //       reply_markup: {
    //         inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]],
    //       },
    //     }
    //   );

    // case 'routine_clear':
    //   return ctx.answerCbQuery('Clearing routine...').then(async () => {
    //     const { handleClearRoutine } = await import('./handlers.js');
    //     return handleClearRoutine(ctx);
    //   });

    // case 'notes_add':
    //   return ctx.answerCbQuery('Starting note creation...').then(async () => {
    //     const { handleAddNote } = await import('../notes/handlers/noteCommands.js');
    //     return handleAddNote(ctx);
    //   });

    // case 'notes_list':
    //   return ctx.answerCbQuery('Loading notes...').then(async () => {
    //     const { handleListNotes } = await import('../notes/handlers/noteCommands.js');
    //     return handleListNotes(ctx);
    //   });

    // case 'notes_search':
    //   await ctx.answerCbQuery();
    //   botSessionManager.start(ctx.from.id, 'notes_search');
    //   return ctx.editMessageText(
    //     '🔍 <b>Search Notes</b>\n\nType a keyword to search:',
    //     {
    //       parse_mode: 'HTML',
    //       reply_markup: {
    //         inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'session_cancel' }]],
    //       },
    //     }
    //   );

    // case 'notes_tags':
    //   return ctx.answerCbQuery('Loading tags...').then(async () => {
    //     const { handleListTags } = await import('../notes/handlers/noteCommands.js');
    //     return handleListTags(ctx);
    //   });

    // case 'notes_cancel':
    //   return ctx.answerCbQuery('Creation cancelled.').then(async () => {
    //     const { noteSessionManager } = await import('../notes/managers/sessionManager.js');
    //     noteSessionManager.cancelSession(ctx.from.id);
    //     return safeEdit(ctx,'❌ Note creation cancelled.');
    //   });

    case 'profile_edit':
      await ctx.answerCbQuery();
      botSessionManager.start(ctx.from.id, 'profile_edit');
      return safeEdit(ctx,
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
      return safeEdit(ctx,MenuBuilder.mainMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.mainMenu().reply_markup,
      });

    case 'menu_learn':
      return safeEdit(ctx,MenuBuilder.learningMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.learningMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_run':
      return safeEdit(ctx,MenuBuilder.runMenu().text, {
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
        return safeEdit(ctx,'📅 <b>Today\'s Plan</b>\n\nNo topics scheduled for today.', {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_learn' }]] },
        });
      }
      const STATUS_EMOJI = { planned: '📋', 'in-progress': '🔄', completed: '✅', skipped: '⏭️' };
      const lines = result.data.map(t => `  • ${STATUS_EMOJI[t.status]} ${escapeHtml(t.title)} — ${t.schedule.time || 'No time'}`).join('\n');
      return safeEdit(ctx,`📅 <b>Today's Plan</b>\n\n${lines}`, {
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
      multiLineSessionManager.start(ctx.from.id, 'learn_search', 'Search Topics', 'Search');
      return safeEdit(ctx,
        '🔍 <b>Search Topics</b>\n\nType keywords. Each message is appended.\n\nPress ✅ Search when ready.',
        { parse_mode: 'HTML', reply_markup: multiLineKeyboard('Search') }
      );

    case 'learn_add_prompt':
      multiLineSessionManager.start(ctx.from.id, 'learn_add', 'Add Topic', 'Add');
      return safeEdit(ctx,
        '➕ <b>Add Topic</b>\n\nType the topic title. Each message is appended.\n\nPress ✅ Add when ready.',
        { parse_mode: 'HTML', reply_markup: multiLineKeyboard('Add') }
      );

    case 'learn_status_prompt': {
      await ctx.answerCbQuery();
      const { handleLearnView } = await import('../learning/handlers/learningCommands.js');
      return handleLearnView(ctx);
    }

    case 'run_prompt':
      return ctx.answerCbQuery().then(async () => {
        const { handleRun } = await import('./runHandler.js');
        ctx.message = { text: '/run', from: ctx.from };
        return handleRun(ctx);
      });

    case 'run_execute': {
      const { handleRunExecute } = await import('./runHandler.js');
      return handleRunExecute(ctx);
    }

    case 'run_clear': {
      const { handleRunClear } = await import('./runHandler.js');
      return handleRunClear(ctx);
    }

    case 'run_cancel': {
      const { handleRunCancel } = await import('./runHandler.js');
      return handleRunCancel(ctx);
    }

    case 'multiline_submit': {
      const telegramId = ctx.from.id;
      const session = multiLineSessionManager.get(telegramId);
      if (!session || !session.text) {
        return ctx.answerCbQuery('⚠️ Nothing to submit. Type something first!');
      }
      multiLineSessionManager.end(telegramId);
      await ctx.answerCbQuery('✅ Submitting…');

      switch (session.type) {
        case 'study_ask': {
          const { handleAsk } = await import('./handlers.js');
          ctx.message.text = `/ask ${session.text}`;
          return handleAsk(ctx);
        }
        case 'study_search': {
          const { handleSearch } = await import('./handlers.js');
          return handleSearch(ctx, session.text.split(' '));
        }
        case 'learn_add': {
          const { handleLearnAdd } = await import('../learning/handlers/learningCommands.js');
          ctx.message.text = `/learn_add ${session.text}`;
          return handleLearnAdd(ctx, session.text.split(' '));
        }
        case 'learn_search': {
          const { handleLearnSearch } = await import('../learning/handlers/learningCommands.js');
          return handleLearnSearch(ctx, session.text.split(' '));
        }
        case 'learn_note': {
          const { CreateNoteUseCase, LinkNoteToTopicUseCase } = await import('../notes/useCases/index.js');
          const createNote = new CreateNoteUseCase();
          const link = new LinkNoteToTopicUseCase();
          const parts = session.text.split('\n\n');
          const noteTitle = parts[0] || 'Learning Note';
          const noteContent = parts.slice(1).join('\n\n') || session.text;
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
        case 'learn_code': {
          const { AddCodeSnippetUseCase } = await import('../learning/useCases/index.js');
          const addSnippet = new AddCodeSnippetUseCase();
          const result = await addSnippet.execute({
            userId: telegramId,
            topicId: session.data.topicId,
            title: 'Snippet',
            code: session.text,
            language: 'python',
          });
          if (!result.success) return ctx.reply(`❌ ${result.error}`);
          return ctx.reply('✅ Code snippet added!');
        }
        case 'learn_schedule': {
          const { handleLearnSchedule } = await import('../learning/handlers/learningCommands.js');
          return handleLearnSchedule(ctx, [session.data.topicId, ...session.text.split(' ')]);
        }
        default:
          return ctx.reply('⚠️ Unknown session type.');
      }
    }

    case 'multiline_clear': {
      const telegramId = ctx.from.id;
      const session = multiLineSessionManager.get(telegramId);
      if (!session) return ctx.answerCbQuery('⚠️ No active session.');
      multiLineSessionManager.clear(telegramId);
      await ctx.answerCbQuery('🗑 Cleared');
      return safeEdit(ctx,
        `📝 <b>${session.title}</b>\n\n<i>Type your input. Each message is appended.</i>\n\nPress ✅ ${session.submitLabel} when ready.`,
        { parse_mode: 'HTML', reply_markup: multiLineKeyboard(session.submitLabel) }
      );
    }

    case 'multiline_cancel': {
      const telegramId = ctx.from.id;
      multiLineSessionManager.end(telegramId);
      await ctx.answerCbQuery('❌ Cancelled');
      return safeEdit(ctx,'❌ Session cancelled.');
    }

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

    default:
      botSessionManager.end(telegramId);
      return false;
  }
}
