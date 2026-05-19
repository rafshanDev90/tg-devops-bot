import {
  CreateNoteUseCase,
  ListNotesUseCase,
  ViewNoteUseCase,
  SearchNotesUseCase,
  UpdateNoteUseCase,
  DeleteNoteUseCase,
  ListTagsUseCase,
} from '../useCases/index.js';
import { noteSessionManager, STEPS } from '../managers/sessionManager.js';
import { CATEGORIES, CATEGORY_LABELS } from '../domain/noteEntity.js';
import { requireNoteAccess } from '../middleware/noteAuth.js';
import { logger } from '../../utils/logger.js';

const createNote = new CreateNoteUseCase();
const listNotes = new ListNotesUseCase();
const viewNote = new ViewNoteUseCase();
const searchNotes = new SearchNotesUseCase();
const updateNote = new UpdateNoteUseCase();
const deleteNote = new DeleteNoteUseCase();
const listTags = new ListTagsUseCase();

export async function handleNotesCommand(ctx, next) {
  await requireNoteAccess(ctx, async () => {
    const args = ctx.message.text.replace('/notes', '').trim().split(' ');
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case 'add':
        return handleAddNote(ctx);
      case 'list':
        return handleListNotes(ctx, args[1]);
      case 'search':
        return handleSearchNotes(ctx, args.slice(1).join(' '));
      case 'tags':
        return handleListTags(ctx);
      case 'help':
      default:
        return showNotesHelp(ctx);
    }
    return next();
  });
}

export async function handleNoteViewCommand(ctx) {
  await requireNoteAccess(ctx, async () => {
    const noteId = ctx.message.text.replace('/view_note', '').trim();
    if (!noteId) {
      return ctx.reply('❌ Usage: /view_note <note_id>');
    }

    const result = await viewNote.execute({ userId: ctx.from.id, noteId });
    if (!result.success) {
      return ctx.reply(`❌ ${result.error}`);
    }

    const note = result.data;
    const categoryLabel = CATEGORY_LABELS[note.category] || note.category;
    const tagsText = note.tags.length ? `\n🏷️ Tags: ${note.tags.join(', ')}` : '';
    const metaText = `\n👁️ Views: ${note.viewCount} | 📅 ${note.createdAt.toLocaleDateString()}`;

    let contentText = note.content;
    let keyboard = {};

    if (note.isEncrypted && note.content === '🔒 Encrypted — tap Reveal to view') {
      contentText = '🔒 This note is encrypted.';
      keyboard = {
        reply_markup: {
          inline_keyboard: [[{ text: '🔓 Reveal Content', callback_data: `reveal_${noteId}` }]]
        }
      };
    } else {
      keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Copy to Clipboard', callback_data: `copy_${noteId}` }],
            [{ text: '✏️ Edit', callback_data: `edit_${noteId}` }, { text: '🗑️ Delete', callback_data: `confirm_delete_${noteId}` }]
          ]
        }
      };
    }

    ctx.reply(
      `📝 <b>${escapeHtml(note.title)}</b>\n` +
      `${categoryLabel}\n` +
      `──────────────────\n` +
      `<pre>${escapeHtml(contentText)}</pre>\n` +
      `${tagsText}${metaText}`,
      { parse_mode: 'HTML', ...keyboard }
    );
  });
}

export async function handleNoteCallback(ctx) {
  const data = ctx.callbackQuery.data;

  if (data.startsWith('reveal_')) {
    return handleRevealNote(ctx, data.replace('reveal_', ''));
  }
  if (data.startsWith('copy_')) {
    return handleCopyNote(ctx, data.replace('copy_', ''));
  }
  if (data.startsWith('edit_')) {
    return handleEditNoteStart(ctx, data.replace('edit_', ''));
  }
  if (data.startsWith('confirm_delete_')) {
    return handleConfirmDelete(ctx, data.replace('confirm_delete_', ''));
  }
  if (data.startsWith('delete_')) {
    return handleDeleteNote(ctx, data.replace('delete_', ''));
  }
  if (data.startsWith('cancel_delete_')) {
    return ctx.editMessageText('✅ Delete cancelled.').then(() => ctx.answerCbQuery());
  }
  if (data.startsWith('cat_')) {
    return handleCategorySelect(ctx, data.replace('cat_', ''));
  }
  if (data.startsWith('encrypt_')) {
    return handleEncryptSelect(ctx, data.replace('encrypt_', ''));
  }

  return ctx.answerCbQuery();
}

async function handleAddNote(ctx) {
  noteSessionManager.startNoteCreation(ctx.from.id);
  ctx.reply(
    `📝 <b>Create New Note</b>\n\n` +
    `Enter a <b>title</b> for your note:\n` +
    `<i>(Max 200 characters)</i>`,
    { parse_mode: 'HTML' }
  );
}

async function handleListNotes(ctx, filter) {
  let category, tag;

  if (filter) {
    if (Object.values(CATEGORIES).includes(filter.toLowerCase())) {
      category = filter.toLowerCase();
    } else {
      tag = filter.toLowerCase();
    }
  }

  const result = await listNotes.execute({ userId: ctx.from.id, category, tag, page: 1, limit: 10 });
  if (!result.success) {
    return ctx.reply(`❌ ${result.error}`);
  }

  if (!result.data.length) {
    return ctx.reply('📭 No notes found.');
  }

  const lines = result.data.map((n, i) => {
    const cat = CATEGORY_LABELS[n.category] || n.category;
    const tags = n.tags.length ? ` [${n.tags.join(', ')}]` : '';
    const lock = n.isEncrypted ? '🔒' : '';
    return `${i + 1}. ${lock} <b>${escapeHtml(n.title)}</b> — ${cat}${tags}\n   <code>${n.id}</code>`;
  });

  const filterText = category ? ` (Category: ${category})` : tag ? ` (Tag: ${tag})` : '';
  const footer = result.hasMore ? `\n\n<i>Showing 10 of ${result.total}. Use /notes search to find more.</i>` : '';

  ctx.reply(
    `📋 <b>Your Notes</b>${filterText}\n` +
    `──────────────────\n\n` +
    lines.join('\n\n') +
    footer,
    { parse_mode: 'HTML' }
  );
}

async function handleSearchNotes(ctx, query) {
  if (!query) {
    return ctx.reply('❌ Usage: /notes search <keyword>');
  }

  const result = await searchNotes.execute({ userId: ctx.from.id, query });
  if (!result.success) {
    return ctx.reply(`❌ ${result.error}`);
  }

  if (!result.data.length) {
    return ctx.reply(`🔍 No notes found for "${escapeHtml(query)}".`);
  }

  const lines = result.data.map((n, i) => {
    const cat = CATEGORY_LABELS[n.category] || n.category;
    const lock = n.isEncrypted ? '🔒' : '';
    return `${i + 1}. ${lock} <b>${escapeHtml(n.title)}</b> — ${cat}\n   <code>${n.id}</code>`;
  });

  ctx.reply(
    `🔍 <b>Search Results</b> (${result.count})\n` +
    `──────────────────\n\n` +
    lines.join('\n\n'),
    { parse_mode: 'HTML' }
  );
}

async function handleListTags(ctx) {
  const result = await listTags.execute({ userId: ctx.from.id });
  if (!result.success || !result.data.length) {
    return ctx.reply('🏷️ No tags found.');
  }

  const lines = result.data.map(t => `• <b>${escapeHtml(t.tag)}</b> (${t.count})`);

  ctx.reply(
    `🏷️ <b>Your Tags</b>\n` +
    `──────────────────\n\n` +
    lines.join('\n') +
    `\n\n<i>Use /notes list &lt;tag&gt; to filter</i>`,
    { parse_mode: 'HTML' }
  );
}

async function handleRevealNote(ctx, noteId) {
  await ctx.answerCbQuery();
  const result = await viewNote.execute({ userId: ctx.from.id, noteId, reveal: true });
  if (!result.success) {
    return ctx.reply(`❌ ${result.error}`);
  }

  const note = result.data;
  ctx.reply(
    `🔓 <b>${escapeHtml(note.title)}</b>\n\n` +
    `<pre>${escapeHtml(note.content)}</pre>`,
    { parse_mode: 'HTML' }
  );
}

async function handleCopyNote(ctx, noteId) {
  await ctx.answerCbQuery('📋 Copied to clipboard!');
  const result = await viewNote.execute({ userId: ctx.from.id, noteId, reveal: true });
  if (result.success) {
    ctx.reply(`<pre>${escapeHtml(result.data.content)}</pre>`, { parse_mode: 'HTML' });
  }
}

async function handleEditNoteStart(ctx, noteId) {
  await ctx.answerCbQuery();
  ctx.reply(
    `✏️ <b>Edit Note</b>\n\n` +
    `Reply to this message with the new content.\n` +
    `<i>Use /cancel_edit to abort</i>`,
    { parse_mode: 'HTML' }
  );
  noteSessionManager.sessions.set(ctx.from.id, {
    step: 'editing',
    data: { noteId },
    createdAt: Date.now(),
  });
}

async function handleConfirmDelete(ctx, noteId) {
  await ctx.answerCbQuery();
  ctx.editMessageText(
    `🗑️ <b>Delete Note?</b>\n\n` +
    `This action cannot be undone.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑️ Yes, Delete', callback_data: `delete_${noteId}` }],
          [{ text: '❌ Cancel', callback_data: `cancel_delete_${noteId}` }]
        ]
      }
    }
  );
}

async function handleDeleteNote(ctx, noteId) {
  await ctx.answerCbQuery();
  const result = await deleteNote.execute({ userId: ctx.from.id, noteId });
  if (!result.success) {
    return ctx.reply(`❌ ${result.error}`);
  }
  ctx.reply('✅ Note deleted successfully.');
}

async function handleCategorySelect(ctx, category) {
  await ctx.answerCbQuery();
  noteSessionManager.advanceStep(ctx.from.id, STEPS.AWAITING_CATEGORY, category);

  ctx.reply(
    `✅ Category: <b>${CATEGORY_LABELS[category]}</b>\n\n` +
    `Now enter the <b>content</b> of your note:\n` +
    `<i>(Max 4000 characters)</i>`,
    { parse_mode: 'HTML' }
  );
}

async function handleEncryptSelect(ctx, value) {
  await ctx.answerCbQuery();
  const encrypt = value === 'yes';
  noteSessionManager.advanceStep(ctx.from.id, STEPS.AWAITING_ENCRYPT, encrypt);

  const sessionData = noteSessionManager.completeSession(ctx.from.id);
  if (!sessionData) {
    return ctx.reply('❌ Session expired. Use /notes add to start again.');
  }

  const result = await createNote.execute({
    userId: ctx.from.id,
    title: sessionData[STEPS.AWAITING_TITLE],
    content: sessionData[STEPS.AWAITING_CONTENT],
    category: sessionData[STEPS.AWAITING_CATEGORY],
    tags: sessionData[STEPS.AWAITING_TAGS],
    encrypt,
  });

  if (!result.success) {
    return ctx.reply(`❌ Failed to create note: ${result.error}`);
  }

  ctx.reply(
    `✅ <b>Note Created!</b>\n\n` +
    `📝 ${escapeHtml(result.data.title)}\n` +
    `${CATEGORY_LABELS[result.data.category]} ${encrypt ? '🔒' : ''}`,
    { parse_mode: 'HTML' }
  );
}

function showNotesHelp(ctx) {
  ctx.reply(
    `📝 <b>Personal Knowledge Vault</b>\n\n` +
    `<b>Commands:</b>\n` +
    `/notes add — Create a new note\n` +
    `/notes list [category|tag] — List your notes\n` +
    `/notes search &lt;query&gt; — Search notes\n` +
    `/notes tags — View all tags\n` +
    `/view_note &lt;id&gt; — View a note\n\n` +
    `<b>Categories:</b>\n` +
    `${Object.values(CATEGORY_LABELS).join('\n')}\n\n` +
    `<i>Only accessible to admins</i>`,
    { parse_mode: 'HTML' }
  );
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
