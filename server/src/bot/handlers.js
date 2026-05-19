import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { AssignmentStatus } from '../models/AssignmentStatus.js';
import { StudyAgent } from '../agents/studyAgent.js';
import { AIService } from '../services/aiServices.js';
import { StudentService } from '../services/studentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SupabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { requireAdmin } from '../middleware/admin.js';
import { MenuBuilder } from './menuBuilder.js';

const aiService = new AIService();
const studyAgent = new StudyAgent(aiService);
const studentService = new StudentService();

let routineService = null;
let dailyRoutineJob = null;

export function initRoutine(service, job) {
  routineService = service;
  dailyRoutineJob = job;
}

async function getOrCreateStudent(ctx) {
  const from = ctx.from;
  const student = await Student.findOne({ telegramId: from.id });
  if (!student || !student.metadata.onboardingCompleted) {
    return null;
  }
  student.metadata.lastActiveAt = new Date();
  await student.save();
  return student;
}

export async function handleStart(ctx) {
  const existingStudent = await Student.findOne({ telegramId: ctx.from.id });
  if (existingStudent && existingStudent.metadata.onboardingCompleted) {
    return ctx.reply(MenuBuilder.mainMenu().text, {
      parse_mode: 'HTML',
      reply_markup: MenuBuilder.mainMenu().reply_markup,
    });
  }
  return ctx.reply(
    `🎓 Welcome to AMUST Hub!\n\n` +
    `Use /setup_profile to set up your account first.`,
    { parse_mode: 'HTML' }
  );
}

export async function handleStatus(ctx) {
  const mongoState = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  ctx.reply(
    `System Status: Healthy\nBot: Running\nMongoDB: ${mongoState}\nUptime: ${process.uptime().toFixed(0)}s\nBuild: 2026-05-15-v2`
  );
}

export async function handleAsk(ctx) {
  const question = ctx.message.text.replace('/ask', '').trim();
  if (!question) {
    return ctx.reply('Please provide a question. Usage: /ask <your question>');
  }

  const student = await getOrCreateStudent(ctx);
  await ctx.reply('Thinking...');
  try {
    const answer = await studyAgent.answerQuestion(question, student._id);
    
    // Split answer into chunks to avoid massive single cards and fit limits
    const MAX_CHUNK_SIZE = 1200;
    const chunks = [];
    if (answer.length > MAX_CHUNK_SIZE) {
      let currentChunk = '';
      const paragraphs = answer.split('\n\n');
      for (const p of paragraphs) {
        if (currentChunk.length + p.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = p + '\n\n';
        } else {
          currentChunk += p + '\n\n';
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
    } else {
      chunks.push(answer);
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let prefix = i === 0 ? '💡 <b>Study Assistant</b>\n━━━━━━━━━━━━━━━\n\n' : '<i>...continued</i>\n\n';
      
      let htmlChunk = prefix + chunk
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold
        .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<i>$1</i>') // Italic
        .replace(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g, '<pre>$1</pre>') // Code blocks
        .replace(/`(.*?)`/g, '<code>$1</code>') // Inline code
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>'); // Links
        
      await ctx.reply(htmlChunk, { parse_mode: 'HTML' }).catch(async (err) => {
        // Fallback to plain text if HTML parsing fails
        logger.warn('AskCommand', 'HTML parse failed, falling back to plain text', { error: err.message });
        const fallbackPrefix = i === 0 ? '💡 Study Assistant\n━━━━━━━━━━━━━━━\n\n' : '...continued\n\n';
        await ctx.reply(fallbackPrefix + chunk.substring(0, 4000));
      });
    }
  } catch (err) {
    logger.error('AskCommand', 'Failed to generate answer', { error: err.message });
    ctx.reply('Sorry, something went wrong. Please try again.');
  }
}

export async function handleAssignments(ctx) {
  const student = await getOrCreateStudent(ctx);
  const assignments = await AssignmentStatus.find({ studentId: student._id })
    .sort({ dueDate: 1 })
    .limit(20)
    .lean();

  if (!assignments.length) return ctx.reply('No assignments found.');

  const lines = assignments.map(
    (a) => `- ${a.title} | Due: ${a.dueDate.toISOString().slice(0, 10)} | Status: ${a.status}`
  );
  ctx.reply(`Your Assignments:\n${lines.join('\n')}`);
}

export async function handleUploadRoutine(ctx) {
  const telegramId = ctx.from.id;
  const student = await getOrCreateStudent(ctx);
  if (!student) {
    return ctx.reply('⚠️ Please set up your profile first using /setup_profile.');
  }
  let text = '';
  let fileType = 'text';

  // Check if it's a command with text or a photo/document with caption
  const messageText = ctx.message.text || '';
  const messageCaption = ctx.message.caption || '';
  const fullText = (messageText + ' ' + messageCaption).trim();

  if (ctx.message.photo) {
    await ctx.reply('🖼️ Processing your routine image...');
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileLink = await ctx.telegram.getFileLink(file.file_path);
    const response = await fetch(fileLink);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    const visionPrompt = `Extract the class routine from this image. Return ONLY a valid JSON array with no markdown, no explanation.

Each entry must have:
- day_of_week: full day name (Monday-Sunday)
- start_time: HH:MM 24-hour format
- end_time: HH:MM 24-hour format
- subject_name: full subject name
- teacher_name: teacher name or null
- room_number: room number or null
- is_lab: true if it's a lab/practical class

Example: [{"day_of_week":"Monday","start_time":"08:00","end_time":"09:00","subject_name":"Data Structures","teacher_name":"Dr. Rahman","room_number":"301","is_lab":false}]`;

    const aiResponse = await aiService.generateResponseFromImage(imageBuffer, visionPrompt);
    const cleaned = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    text = match ? match[0] : aiResponse;
    fileType = 'image';
  } else if (ctx.message.document) {
    await ctx.reply('📄 Processing your routine file...');
    const file = await ctx.telegram.getFile(ctx.message.document.file_id);
    const filePath = file.file_path;

    if (filePath.endsWith('.txt')) {
      const fileLink = await ctx.telegram.getFileLink(filePath);
      const response = await fetch(fileLink);
      text = await response.text();
      fileType = 'text';
    } else {
      return ctx.reply(
        '❌ Only text files (.txt) and images are supported for routine upload.\n\n' +
        'You can also paste your routine directly:\n' +
        '/upload_routine Monday: 08:00-09:00 Data Structures, Dr. Rahman, Room 301'
      );
    }
  } else {
    text = fullText.replace('/upload_routine', '').trim();
  }

  if (!text && !ctx.message.photo) {
    return ctx.reply(
      '📋 Send your class routine to save it.\n\n' +
      'Options:\n' +
      '1. Send an image/photo of your routine with caption /upload_routine\n' +
      '2. Paste as text: /upload_routine <routine text>\n' +
      '3. Send a .txt file with your routine and caption /upload_routine\n\n' +
      'Example:\n' +
      'Monday 08:00-09:00 Data Structures Dr. Rahman Room 301\n' +
      'Monday 09:00-10:00 Discrete Math Prof. Karim Room 205'
    );
  }

  await ctx.reply('🤖 AI is parsing your routine...');

  try {
    const result = await routineService.uploadRoutine(telegramId, student._id, text, fileType, student.academic.university, student.academic.department, student.academic.batch);

    const daySummary = {};
    for (const c of result.classes) {
      if (!daySummary[c.day_of_week]) daySummary[c.day_of_week] = 0;
      daySummary[c.day_of_week]++;
    }

    const summary = Object.entries(daySummary)
      .map(([day, count]) => `  ${day}: ${count} class${count > 1 ? 'es' : ''}`)
      .join('\n');

    ctx.reply(
      `✅ Routine saved successfully!\n\n` +
      `📊 ${result.classesAdded} classes added:\n${summary}\n\n` +
      `You'll get a daily reminder at 6:00 AM (Bangladesh time).\n` +
      `Use /today to see today's schedule anytime.`
    );
  } catch (err) {
    logger.error('UploadRoutine', 'Failed to upload routine', { error: err.message });
    ctx.reply(`❌ Failed to parse routine: ${err.message}`);
  }
}

export const handleToday = asyncHandler(async (ctx) => {
  const telegramId = ctx.from.id;
  const classes = await routineService.getTodayClasses(telegramId);

  if (!classes.length) {
    const dayName = _getCurrentDayBDT();
    return ctx.reply(`📭 No classes scheduled for ${dayName}. Enjoy your free time! 🎉`);
  }

  const dayName = classes[0].day_of_week;
  const lines = classes.map((c) => {
    const type = c.is_lab ? '🧪' : '📖';
    const teacher = c.teacher_name ? `| ${c.teacher_name}` : '';
    const room = c.room_number ? `| Room ${c.room_number}` : '';
    return `${type} ${c.start_time}-${c.end_time} <b>${c.subject_name}</b> ${room} ${teacher}`;
  });

  const nextClass = _getNextClassInfo(classes);
  const footer = nextClass ? `\n⏰ <i>Next class in ${nextClass}</i>` : '';

  ctx.reply(
    `<b>📅 Today's Schedule — ${dayName}</b>\n\n` +
    lines.join('\n') +
    footer,
    { parse_mode: 'HTML' }
  );
});

export const handleRoutine = asyncHandler(async (ctx) => {
  const telegramId = ctx.from.id;
  const classes = await routineService.getFullRoutine(telegramId);

  if (!classes.length) {
    return ctx.reply(
      '📭 No routine saved yet.\n\n' +
      'Use /upload_routine to add your class schedule.'
    );
  }

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const grouped = {};

  for (const c of classes) {
    if (!grouped[c.day_of_week]) grouped[c.day_of_week] = [];
    grouped[c.day_of_week].push(c);
  }

  const lines = [];
  for (const day of dayOrder) {
    if (!grouped[day]) continue;
    lines.push(`<b>📌 ${day}</b>`);
    for (const c of grouped[day]) {
      const type = c.is_lab ? '🧪' : '📖';
      const teacher = c.teacher_name ? `| ${c.teacher_name}` : '';
      const room = c.room_number ? `| Room ${c.room_number}` : '';
      lines.push(`  ${type} ${c.start_time}-${c.end_time} ${c.subject_name} ${room} ${teacher}`);
    }
    lines.push('');
  }

  ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
});

export const handleClearRoutine = asyncHandler(async (ctx) => {
  const telegramId = ctx.from.id;
  await routineService.clearRoutine(telegramId);
  ctx.reply('🗑️ Your routine has been cleared. Use /routine upload to add a new one.');
});

export async function handleStudyMenu(ctx) {
  ctx.reply(MenuBuilder.studyMenu().text, {
    parse_mode: 'HTML',
    reply_markup: MenuBuilder.studyMenu().reply_markup,
  });
}

export async function handleStudyAsk(ctx, args) {
  const question = args.join(' ').trim();
  if (!question) {
    return ctx.reply('❌ Usage: /study ask <your question>');
  }
  const student = await getOrCreateStudent(ctx);
  if (!student) return ctx.reply('⚠️ Use /setup_profile first.');

  ctx.message.text = `/ask ${question}`;
  return handleAsk(ctx);
}

export async function handleStudyAssign(ctx) {
  return handleAssignments(ctx);
}

export async function handleRoutineMenu(ctx) {
  ctx.reply(MenuBuilder.routineMenu().text, {
    parse_mode: 'HTML',
    reply_markup: MenuBuilder.routineMenu().reply_markup,
  });
}

export async function handleRoutineToday(ctx) {
  return handleToday(ctx);
}

export async function handleRoutineWeek(ctx) {
  return handleRoutine(ctx);
}

export async function handleRoutineUpload(ctx) {
  ctx.reply('📤 Send your routine as:\n• Image with caption\n• Text message\n• .txt file');
}

export async function handleRoutineClear(ctx) {
  return handleClearRoutine(ctx);
}

export async function handleProfileMenu(ctx) {
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student) return ctx.reply('⚠️ Use /setup_profile first.');
  ctx.reply(MenuBuilder.profileMenu(student).text, {
    parse_mode: 'HTML',
    reply_markup: MenuBuilder.profileMenu(student).reply_markup,
  });
}

export async function handleProfileEdit(ctx, args) {
  if (!args.length) {
    return ctx.reply('❌ Usage: /profile edit <field> <value>\nFields: name, university, department, batch, id, language, reminder');
  }
  ctx.message.text = `/edit_profile ${args.join(' ')}`;
  return handleEditProfile(ctx);
}

export async function handleNotesMenu(ctx) {
  ctx.reply(MenuBuilder.notesMenu().text, {
    parse_mode: 'HTML',
    reply_markup: MenuBuilder.notesMenu().reply_markup,
  });
}

export async function handleNotesAdd(ctx) {
  const { handleAddNote } = await import('./notes/handlers/noteCommands.js');
  return handleAddNote(ctx);
}

export async function handleNotesList(ctx, args) {
  const { handleListNotes } = await import('./notes/handlers/noteCommands.js');
  return handleListNotes(ctx, args[0]);
}

export async function handleNotesSearch(ctx, args) {
  const { handleSearchNotes } = await import('./notes/handlers/noteCommands.js');
  return handleSearchNotes(ctx, args.join(' '));
}

export async function handleNotesTags(ctx) {
  const { handleListTags } = await import('./notes/handlers/noteCommands.js');
  return handleListTags(ctx);
}

export async function handleAdminMenu(ctx) {
  await requireAdmin(ctx, async () => {
    ctx.reply(MenuBuilder.adminMenu().text, {
      parse_mode: 'HTML',
      reply_markup: MenuBuilder.adminMenu().reply_markup,
    });
  });
}

export async function handleAdminUsers(ctx, args) {
  await requireAdmin(ctx, async () => {
    ctx.message.text = `/admin_users ${args.join(' ')}`;
    return _handleAdminUsers(ctx, () => {});
  });
}

export async function handleAdminBroadcast(ctx, args) {
  await requireAdmin(ctx, async () => {
    ctx.message.text = `/admin_broadcast ${args.join(' ')}`;
    return _handleAdminBroadcast(ctx, () => {});
  });
}

export async function handleAdminStats(ctx) {
  await requireAdmin(ctx, async () => {
    return _handleAdminStats(ctx, () => {});
  });
}

export async function handleAdminSuspend(ctx, args) {
  await requireAdmin(ctx, async () => {
    ctx.message.text = `/admin_suspend ${args.join(' ')}`;
    return _handleAdminSuspend(ctx, () => {});
  });
}

export async function handleAdminActivate(ctx, args) {
  await requireAdmin(ctx, async () => {
    ctx.message.text = `/admin_activate ${args.join(' ')}`;
    return _handleAdminActivate(ctx, () => {});
  });
}

export async function handleAdminPromote(ctx, args) {
  await requireAdmin(ctx, async () => {
    ctx.message.text = `/admin_make_admin ${args.join(' ')}`;
    return handleMakeAdmin(ctx, () => {});
  });
}

export function handleHelp(ctx) {
  ctx.reply(
    `📚 <b>AMUST Hub — Command Guide</b>\n\n` +
    `<b>Main Menu:</b>\n` +
    `/start — Open main menu\n` +
    `/help — Show this guide\n\n` +
    `<b>📖 Study:</b>\n` +
    `/study — Study menu\n` +
    `/study ask &lt;q&gt; — Ask AI\n` +
    `/study assign — Assignments\n\n` +
    `<b>📅 Routine:</b>\n` +
    `/routine — Routine menu\n` +
    `/routine today — Today's classes\n` +
    `/routine week — Weekly view\n` +
    `/routine upload — Upload routine\n` +
    `/routine clear — Clear routine\n\n` +
    `<b>📝 Notes:</b>\n` +
    `/notes — Notes menu\n` +
    `/notes add — Create note\n` +
    `/notes list — List notes\n` +
    `/notes search &lt;q&gt; — Search\n` +
    `/notes tags — View tags\n` +
    `/view_note &lt;id&gt; — View note\n\n` +
    `<b>👤 Profile:</b>\n` +
    `/profile — Profile menu\n` +
    `/profile edit — Edit info\n` +
    `/profile stats — Activity stats\n\n` +
    `💡 <i>Use the inline menus for easier navigation!</i>`,
    { parse_mode: 'HTML' }
  );
}

export async function handleError(err, ctx) {
  console.error('Bot error:', err);
  const message = err.statusCode >= 500
    ? '⚠️ Something went wrong. Please try again in a moment.'
    : err.message || 'An unexpected error occurred. Please try again.';
  ctx.reply(message).catch(() => {});
}

export const handleProfile = asyncHandler(async (ctx) => {
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student) {
    return ctx.reply('Please use /setup_profile to register first.');
  }

  if (!student.metadata.onboardingCompleted) {
    return ctx.reply('⚠️ Your profile setup is incomplete. Use /setup_profile to complete it.');
  }

  const daysSinceJoin = Math.floor((Date.now() - student.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const lastActive = student.metadata.lastActiveAt
    ? timeAgo(student.metadata.lastActiveAt)
    : 'Never';

  const statusEmoji = {
    ACTIVE: '🟢',
    SUSPENDED: '🔴',
    GRADUATED: '🎓'
  };

  ctx.reply(
    `👤 <b>Your Profile</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `📛 <b>Name:</b> ${escapeHtml(student.name)}\n` +
    `🆔 <b>Telegram ID:</b> ${student.telegramId}\n` +
    `${student.username ? `🔗 <b>Username:</b> @${escapeHtml(student.username)}\n` : ''}` +
    `\n🎓 <b>Academic Info:</b>\n` +
    `   University: ${student.academic.university}\n` +
    `   Department: ${student.academic.department}\n` +
    `   Batch: ${student.academic.batch}\n` +
    `   University ID: ${escapeHtml(student.academic.universityId || 'Not set')}\n` +
    `   Status: ${statusEmoji[student.academic.status] || '⚪'} ${student.academic.status}\n` +
    `\n📊 <b>Stats:</b>\n` +
    `   Commands used: ${student.metadata.totalCommands || 0}\n` +
    `   Member since: ${daysSinceJoin} days ago\n` +
    `   Last active: ${lastActive}\n` +
    `\n⚙️ <b>Preferences:</b>\n` +
    `   Language: ${student.preferences?.language === 'bn' ? 'বাংলা' : 'English'}\n` +
    `   Daily reminder: ${student.preferences?.dailyReminderEnabled ? '✅ ON' : '❌ OFF'}\n` +
    `   Notifications: ${student.preferences?.notificationsEnabled ? '✅ ON' : '❌ OFF'}`,
    { parse_mode: 'HTML' }
  );
});

export const handleProfileStats = asyncHandler(async (ctx) => {
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student) return ctx.reply('⚠️ Use /setup_profile first.');

  const daysSinceJoin = Math.floor((Date.now() - student.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const lastActive = student.metadata.lastActiveAt ? timeAgo(student.metadata.lastActiveAt) : 'Never';
  const history = student.metadata.commandHistory || [];
  const recentCommands = history.slice(-10).map(h => `${h.command} (${timeAgoShort(h.usedAt)})`).join('\n');

  ctx.reply(
    `📊 <b>Activity Stats</b>\n\n` +
    `🔢 Total commands: ${student.metadata.totalCommands || 0}\n` +
    `📅 Member since: ${daysSinceJoin} days ago\n` +
    `⏰ Last active: ${lastActive}\n\n` +
    `<b>Recent Activity:</b>\n` +
    `${recentCommands || 'No activity yet'}`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_profile' }]] } }
  );
});

export const handleEditProfile = asyncHandler(async (ctx) => {
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student) {
    return ctx.reply('Please use /setup_profile to register first.');
  }

  if (!student.metadata.onboardingCompleted) {
    return ctx.reply('⚠️ Complete your profile setup first. Use /setup_profile.');
  }

  const args = ctx.message.text.replace('/edit_profile', '').trim().split(' ');
  if (args.length < 2) {
    return ctx.reply(
      `✏️ <b>Edit Profile</b>\n\n` +
      `Usage:\n` +
      `/edit_profile name &lt;Your Name&gt;\n` +
      `/edit_profile university &lt;AMUST/BUET/DU/NSU&gt;\n` +
      `/edit_profile department &lt;CSE/EEE/ME/CE&gt;\n` +
      `/edit_profile batch &lt;Batch Number&gt;\n` +
      `/edit_profile id &lt;University ID&gt;\n` +
      `/edit_profile language &lt;en/bn&gt;\n` +
      `/edit_profile reminder &lt;on/off&gt;\n\n` +
      `Current: ${escapeHtml(student.name)} | ${student.academic.university} | ${student.academic.department} | Batch ${student.academic.batch}`,
      { parse_mode: 'HTML' }
    );
  }

  const field = args[0].toLowerCase();
  const value = args.slice(1).join(' ');

  switch (field) {
    case 'name':
      if (value.length < 2) return ctx.reply('❌ Name must be at least 2 characters.');
      student.name = value;
      break;
    case 'university':
      student.academic.university = value.toUpperCase();
      break;
    case 'department':
      student.academic.department = value.toUpperCase();
      break;
    case 'batch':
      const batch = parseInt(value);
      if (isNaN(batch) || batch < 1 || batch > 100) return ctx.reply('❌ Enter a valid batch number.');
      student.academic.batch = batch;
      break;
    case 'id':
      const existingWithId = await Student.findOne({ 'academic.universityId': value, telegramId: { $ne: student.telegramId } });
      if (existingWithId) return ctx.reply('❌ This university ID is already registered.');
      student.academic.universityId = value;
      break;
    case 'language':
      if (!['en', 'bn'].includes(value.toLowerCase())) {
        return ctx.reply('❌ Language must be "en" or "bn".');
      }
      student.preferences.language = value.toLowerCase();
      break;
    case 'reminder':
      student.preferences.dailyReminderEnabled = value.toLowerCase() === 'on';
      break;
    default:
      return ctx.reply('❌ Unknown field. Use /edit_profile to see options.');
  }

  await student.save();
  await studentService.syncStudent(student);
  ctx.reply(`✅ Profile updated! ${field} set to "${escapeHtml(value)}".`);
});

export const _handleAdmin = asyncHandler(async (ctx, next) => {
  await requireAdmin(ctx, async () => {
    const totalUsers = await Student.countDocuments();
    const activeUsers = await Student.countDocuments({ 'metadata.isActive': true });
    const suspendedUsers = await Student.countDocuments({ 'academic.status': 'SUSPENDED' });
    const graduatedUsers = await Student.countDocuments({ 'academic.status': 'GRADUATED' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeToday = await Student.countDocuments({ 'metadata.lastActiveAt': { $gte: today } });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeThisWeek = await Student.countDocuments({ 'metadata.lastActiveAt': { $gte: weekAgo } });

    const uniStats = await Student.aggregate([
      { $group: { _id: '$academic.university', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const deptStats = await Student.aggregate([
      { $group: { _id: '$academic.department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const batchStats = await Student.aggregate([
      { $group: { _id: '$academic.batch', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const uniText = uniStats.map(u => `   ${u._id}: ${u.count}`).join('\n');
    const deptText = deptStats.map(b => `   ${b._id}: ${b.count}`).join('\n');
    const batchText = batchStats.map(y => `   Batch ${y._id}: ${y.count}`).join('\n');

    ctx.reply(
      `🛡️ <b>Admin Dashboard</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👥 <b>Users:</b>\n` +
      `   Total: ${totalUsers}\n` +
      `   Active: ${activeUsers}\n` +
      `   Suspended: ${suspendedUsers}\n` +
      `   Graduated: ${graduatedUsers}\n` +
      `\n📈 <b>Activity:</b>\n` +
      `   Today: ${activeToday}\n` +
      `   This week: ${activeThisWeek}\n` +
      `\n🏛️ <b>By University:</b>\n${uniText}\n` +
      `\n🎓 <b>By Department:</b>\n${deptText}\n` +
      `\n📚 <b>By Batch:</b>\n${batchText}\n\n` +
      `<b>Admin Commands:</b>\n` +
      `/admin_users - List/search users\n` +
      `/admin_broadcast - Send message to all\n` +
      `/admin_stats - Detailed analytics\n` +
      `/admin_suspend &lt;id&gt; - Suspend user\n` +
      `/admin_activate &lt;id&gt; - Activate user\n` +
      `/admin_make_admin &lt;id&gt; - Grant admin role`,
      { parse_mode: 'HTML' }
    );
    return next();
  });
});

export const _handleAdminUsers = asyncHandler(async (ctx, next) => {
  await requireAdmin(ctx, async () => {
    const args = ctx.message.text.replace('/admin_users', '').trim();

    let query = {};
    if (args) {
      const searchRegex = new RegExp(args, 'i');
      query = {
        $or: [
          { name: searchRegex },
          { username: searchRegex },
          { telegramId: parseInt(args) || -1 },
          { 'academic.rollNumber': searchRegex }
        ]
      };
    }

    const users = await Student.find(query)
      .sort({ 'metadata.lastActiveAt': -1 })
      .limit(30)
      .lean();

    if (!users.length) {
      return ctx.reply('🔍 No users found.');
    }

    const lines = users.map((u, i) => {
      const status = u.academic.status === 'ACTIVE' ? '🟢' : u.academic.status === 'SUSPENDED' ? '🔴' : '🎓';
      const role = u.role === 'admin' ? '👑' : '';
      const lastActive = u.metadata.lastActiveAt ? timeAgoShort(u.metadata.lastActiveAt) : 'Never';
      return `${i + 1}. ${status}${role} ID: ${u.telegramId} | ${escapeHtml(u.name)} | ${u.academic.university} | ${u.academic.department} B${u.academic.batch} | ${lastActive}`;
    });

    ctx.reply(
      `👥 <b>Users (${users.length})</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      lines.join('\n') +
      (users.length === 30 ? '\n\n<i>Showing first 30 results</i>' : ''),
      { parse_mode: 'HTML' }
    );
    return next();
  });
});

export const _handleAdminBroadcast = asyncHandler(async (ctx, next) => {
  await requireAdmin(ctx, async () => {
    const message = ctx.message.text.replace('/admin_broadcast', '').trim();
    if (!message) {
      return ctx.reply(
        `📢 <b>Broadcast Message</b>\n\n` +
        `Usage: /admin_broadcast &lt;message&gt;\n\n` +
        `This will send the message to all active users.\n` +
        `Supports HTML formatting.`,
        { parse_mode: 'HTML' }
      );
    }

    const users = await Student.find({ 'metadata.isActive': true }).select('telegramId').lean();
    let successCount = 0;
    let failCount = 0;

    await ctx.reply(`📢 Broadcasting to ${users.length} users...`);

    for (const user of users) {
      try {
        await ctx.telegram.sendMessage(user.telegramId, message, { parse_mode: 'HTML' });
        successCount++;
      } catch (err) {
        failCount++;
        logger.error('Broadcast', 'Failed to send message', { telegramId: user.telegramId, error: err.message });
      }
    }

    ctx.reply(
      `✅ Broadcast complete!\n\n` +
      `📤 Sent: ${successCount}\n` +
      `❌ Failed: ${failCount}\n` +
      `👥 Total: ${users.length}`
    );
    return next();
  });
});

export const _handleAdminStats = asyncHandler(async (ctx, next) => {
  await requireAdmin(ctx, async () => {
    const totalCommands = await Student.aggregate([
      { $group: { _id: null, total: { $sum: '$metadata.totalCommands' } } }
    ]);

    const topUsers = await Student.find()
      .sort({ 'metadata.totalCommands': -1 })
      .limit(10)
      .select('name metadata.totalCommands metadata.lastActiveAt')
      .lean();

    const newUsersToday = await Student.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } });
    const newUsersThisWeek = await Student.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
    const newUsersThisMonth = await Student.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });

    const topUsersText = topUsers
      .filter(u => u.metadata.totalCommands > 0)
      .map((u, i) => `${i + 1}. ${escapeHtml(u.name)} - ${u.metadata.totalCommands} commands`)
      .join('\n') || 'No data yet';

    ctx.reply(
      `📊 <b>Detailed Analytics</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📈 <b>Growth:</b>\n` +
      `   Today: +${newUsersToday}\n` +
      `   This week: +${newUsersThisWeek}\n` +
      `   This month: +${newUsersThisMonth}\n` +
      `\n💬 <b>Engagement:</b>\n` +
      `   Total commands: ${totalCommands[0]?.total || 0}\n` +
      `\n🏆 <b>Top 10 Users:</b>\n${topUsersText}`,
      { parse_mode: 'HTML' }
    );
    return next();
  });
});

export const _handleAdminSuspend = asyncHandler(async (ctx, next) => {
  await requireAdmin(ctx, async () => {
    const telegramId = parseInt(ctx.message.text.replace('/admin_suspend', '').trim());
    if (!telegramId) {
      return ctx.reply('❌ Usage: /admin_suspend <telegram_id>');
    }

    const user = await Student.findOne({ telegramId });
    if (!user) {
      return ctx.reply('❌ User not found.');
    }

    user.academic.status = 'SUSPENDED';
    user.metadata.isActive = false;
    await user.save();

    ctx.reply(`🔴 User ${escapeHtml(user.name)} (ID: ${telegramId}) has been suspended.`);
    return next();
  });
});

export const _handleAdminActivate = asyncHandler(async (ctx, next) => {
  await requireAdmin(ctx, async () => {
    const telegramId = parseInt(ctx.message.text.replace('/admin_activate', '').trim());
    if (!telegramId) {
      return ctx.reply('❌ Usage: /admin_activate <telegram_id>');
    }

    const user = await Student.findOne({ telegramId });
    if (!user) {
      return ctx.reply('❌ User not found.');
    }

    user.academic.status = 'ACTIVE';
    user.metadata.isActive = true;
    await user.save();

    ctx.reply(`🟢 User ${escapeHtml(user.name)} (ID: ${telegramId}) has been activated.`);
    return next();
  });
});

export const handleMakeAdmin = asyncHandler(async (ctx, next) => {
  await requireAdmin(ctx, async () => {
    const telegramId = parseInt(ctx.message.text.replace('/admin_make_admin', '').trim());
    if (!telegramId) {
      return ctx.reply('❌ Usage: /admin_make_admin <telegram_id>');
    }

    const user = await Student.findOne({ telegramId });
    if (!user) {
      return ctx.reply('❌ User not found.');
    }

    user.role = 'admin';
    await user.save();

    ctx.reply(`👑 User ${escapeHtml(user.name)} (ID: ${telegramId}) is now an admin.`);
    return next();
  });
});

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

function timeAgoShort(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function _getCurrentDayBDT() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();
  const bdtTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  return days[bdtTime.getDay()];
}

function _getNextClassInfo(classes) {
  const now = new Date();
  const bdtTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  const currentMinutes = bdtTime.getHours() * 60 + bdtTime.getMinutes();

  for (const c of classes) {
    const [h, m] = c.start_time.split(':').map(Number);
    const classMinutes = h * 60 + m;
    const diff = classMinutes - currentMinutes;
    if (diff > 0) {
      if (diff < 60) return `${diff} minutes`;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
    }
  }
  return null;
}
