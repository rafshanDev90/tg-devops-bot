import mongoose from 'mongoose';

const learningTopicSchema = new mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  status: {
    type: String,
    enum: ['planned', 'in-progress', 'completed'],
    default: 'planned',
    index: true,
  },
  tags: [{ type: String, trim: true, lowercase: true }],
  resources: [{ type: String, trim: true }],
}, { timestamps: true });

learningTopicSchema.index({ userId: 1, status: 1 });
learningTopicSchema.index({ userId: 1, createdAt: -1 });

export const LearningTopic = mongoose.model('LearningTopic', learningTopicSchema);
