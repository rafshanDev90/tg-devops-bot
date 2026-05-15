import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { AssignmentStatus } from '../models/AssignmentStatus.js';
import { StudyAgent } from '../agents/studyAgent.js';
import { AIService } from '../services/aiServices.js';

const aiService = new AIService();
const studyAgent = new StudyAgent(aiService);

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
  ctx.reply('Welcome to the DevOps Study Bot!\nUse /help to see available commands.');
}

export async function handleStatus(ctx) {
  const mongoState = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  ctx.reply(
    `System Status: Healthy\nBot: Running\nMongoDB: ${mongoState}\nUptime: ${process.uptime().toFixed(0)}s`
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

export async function handleHelp(ctx) {
  ctx.reply(
    'Available Commands:\n' +
    '/start - Register and start\n' +
    '/status - System health\n' +
    '/ask <question> - Ask a study question\n' +
    '/assignments - View your assignments\n' +
    '/help - Show this message'
  );
}

export async function handleError(err, ctx) {
  console.error('Bot error:', err);
  ctx.reply('An unexpected error occurred. Please try again.').catch(() => {});
}
