import { noteSessionManager, STEPS } from '../managers/sessionManager.js';
import { CATEGORIES, CATEGORY_LABELS } from '../domain/noteEntity.js';
import { logger } from '../../utils/logger.js';

export async function handleNoteCreationMessage(ctx) {
  const telegramId = ctx.from.id;
  const session = noteSessionManager.getSession(telegramId);

  if (!session) return;

  const text = ctx.message?.text?.trim();
  if (!text) return;

  if (text === '/cancel_edit' || text === '/cancel') {
    noteSessionManager.cancelSession(telegramId);
    return ctx.reply('✅ Cancelled.');
  }

  if (session.step === 'editing') {
    return handleEditContent(ctx, telegramId, text);
  }

  try {
    switch (session.step) {
      case STEPS.AWAITING_TITLE:
        await handleTitleStep(ctx, telegramId, text);
        break;
      case STEPS.AWAITING_CATEGORY:
        await ctx.reply('⚠️ Please select a category using the buttons.');
        break;
      case STEPS.AWAITING_CONTENT:
        await handleContentStep(ctx, telegramId, text);
        break;
      case STEPS.AWAITING_TAGS:
        await handleTagsStep(ctx, telegramId, text);
        break;
      case STEPS.AWAITING_ENCRYPT:
        await ctx.reply('⚠️ Please select encryption option.');
        break;
      default:
        noteSessionManager.cancelSession(telegramId);
    }
  } catch (err) {
    logger.error('NoteCreation', 'Error in creation flow', { telegramId, error: err.message });
    await ctx.reply('❌ Something went wrong. Use /notes add to try again.');
    noteSessionManager.cancelSession(telegramId);
  }
}

async function handleTitleStep(ctx, telegramId, title) {
  if (title.length < 1 || title.length > 200) {
    return ctx.reply('❌ Title must be between 1 and 200 characters.');
  }

  noteSessionManager.advanceStep(telegramId, STEPS.AWAITING_TITLE, title);

  const keyboard = [];
  const entries = Object.entries(CATEGORY_LABELS);
  for (let i = 0; i < entries.length; i += 2) {
    const row = [{ text: entries[i][1], callback_data: `cat_${entries[i][0]}` }];
    if (entries[i + 1]) {
      row.push({ text: entries[i + 1][1], callback_data: `cat_${entries[i + 1][0]}` });
    }
    keyboard.push(row);
  }
  keyboard.push([{ text: '🔙 Cancel', callback_data: 'notes_cancel' }]);

  await ctx.reply(
    `✅ Title: <b>${escapeHtml(title)}</b>\n\n` +
    `Select a <b>category</b>:`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    }
  );
}

async function handleContentStep(ctx, telegramId, content) {
  if (content.length < 1 || content.length > 4000) {
    return ctx.reply('❌ Content must be between 1 and 4000 characters.');
  }

  noteSessionManager.advanceStep(telegramId, STEPS.AWAITING_CONTENT, content);

  await ctx.reply(
    `✅ Content saved.\n\n` +
    `Enter <b>tags</b> (comma-separated, max 5):\n` +
    `<i>Example: work, api, project-x</i>\n` +
    `Send <b>skip</b> to continue without tags.`,
    { parse_mode: 'HTML' }
  );
}

async function handleTagsStep(ctx, telegramId, text) {
  let tags = [];
  if (text.toLowerCase() !== 'skip') {
    tags = text.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5);
  }

  noteSessionManager.advanceStep(telegramId, STEPS.AWAITING_TAGS, tags);

  await ctx.reply(
    `✅ Tags: ${tags.length ? tags.map(t => `<code>${escapeHtml(t)}</code>`).join(', ') : 'None'}\n\n` +
    `Encrypt this note?\n` +
    `<i>Encrypted notes require a button tap to reveal content.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔒 Yes, Encrypt', callback_data: 'encrypt_yes' }],
          [{ text: '📄 No, Plain Text', callback_data: 'encrypt_no' }],
          [{ text: '🔙 Cancel', callback_data: 'notes_cancel' }]
        ]
      }
    }
  );
}

async function handleEditContent(ctx, telegramId, content) {
  const session = noteSessionManager.getSession(telegramId);
  if (!session || session.step !== 'editing') return;

  const noteId = session.data.noteId;
  noteSessionManager.cancelSession(telegramId);

  const { UpdateNoteUseCase } = await import('../useCases/index.js');
  const updateNote = new UpdateNoteUseCase();

  const result = await updateNote.execute({ userId: telegramId, noteId, updates: { content } });
  if (!result.success) {
    return ctx.reply(`❌ ${result.error}`);
  }

  ctx.reply('✅ Note content updated successfully.');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
