import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    index: true
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningTopic',
    sparse: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 4000
  },
  category: {
    type: String,
    required: true,
    enum: ['credentials', 'requirements', 'meetings', 'snippets', 'servers', 'learning', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isEncrypted: {
    type: Boolean,
    default: false
  },
  metadata: {
    createdFrom: { type: String, default: 'bot' },
    lastViewedAt: { type: Date },
    viewCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

noteSchema.index({ userId: 1, createdAt: -1 });
noteSchema.index({ userId: 1, tags: 1 });
noteSchema.index({ userId: 1, category: 1 });
noteSchema.index({ title: 'text', content: 'text' });

export const Note = mongoose.model('Note', noteSchema);
