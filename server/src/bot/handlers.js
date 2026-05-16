import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { AssignmentStatus } from '../models/AssignmentStatus.js';
import { StudyAgent } from '../agents/studyAgent.js';
import { AIService } from '../services/aiServices.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SupabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const aiService = new AIService();
const studyAgent = new StudyAgent(aiService);

let routineService = null;
let dailyRoutineJob = null;

export function initRoutine(service, job) {
  routineService = service;
  dailyRoutineJob = job;
}

async function getOrCreateStudent(ctx) {
  const from = ctx.from;
  let student = await Student.findOne({ telegramId: from.id });
  if (!student) {
    student = await Student.create({
      telegramId: from.id,
      name: from.first_name || 'Unknown',
      username: from.username,
      academic: { year: 2, branch: 'CSE' },
    });
  }
  student.metadata.lastActiveAt = new Date();
  await student.save();
  return student;
}

export async function handleStart(ctx) {
  await getOrCreateStudent(ctx);
  ctx.reply(
    'Welcome to the DevOps Study Bot!\n\n' +
    'Use /help to see available commands.'
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
    ctx.reply(answer, { parse_mode: 'Markdown' });
  } catch (err) {
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
    const result = await routineService.uploadRoutine(telegramId, text, fileType);

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
  ctx.reply('🗑️ Your routine has been cleared. Use /upload_routine to add a new one.');
});

export function handleHelp(ctx) {
  ctx.reply(
    '📚 <b>Available Commands:</b>\n\n' +
    '<b>General:</b>\n' +
    '/start - Register and start\n' +
    '/status - System health\n' +
    '/help - Show this message\n\n' +
    '<b>Study:</b>\n' +
    '/ask &lt;question&gt; - Ask a study question\n' +
    '/assignments - View your assignments\n\n' +
    '<b>Routine:</b>\n' +
    '/upload_routine - Upload your class routine (image, text, or .txt file)\n' +
    '/today - Show today\'s class schedule\n' +
    '/routine - Show full weekly routine\n' +
    '/clear_routine - Delete your saved routine\n\n' +
    '💡 <i>Daily reminders are sent at 6:00 AM (Bangladesh time)</i>',
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
