import mongoose from 'mongoose';

const learningTopicSchema = new mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  status: {
    type: String,
    enum: ['planned', 'in-progress', 'completed', 'skipped'],
    default: 'planned',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  tags: [{ type: String, trim: true, lowercase: true }],
  resources: [{ type: String, trim: true }],
  codeSnippets: [{
    title: String,
    code: String,
    language: { type: String, default: 'python' },
    createdAt: { type: Date, default: Date.now }
  }],
  schedule: {
    date: Date,
    time: String,
    reminderEnabled: { type: Boolean, default: true },
    estimatedMinutes: { type: Number, default: 60 },
    actualMinutes: { type: Number, default: 0 }
  },
  notes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note'
  }],
  parentTopic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningTopic',
    sparse: true
  },
  completedAt: Date,
}, { timestamps: true });

learningTopicSchema.index({ userId: 1, status: 1 });
learningTopicSchema.index({ userId: 1, 'schedule.date': 1 });
learningTopicSchema.index({ userId: 1, createdAt: -1 });
learningTopicSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const LearningTopic = mongoose.model('LearningTopic', learningTopicSchema);
