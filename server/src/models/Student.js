// src/models/Student.js
import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  telegramId: { 
    type: Number, 
    required: true, 
    unique: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  username: { type: String, trim: true },
  
  role: { type: String, enum: ['student', 'admin', 'moderator'], default: 'student' },

  academic: {
    university: { type: String, required: true, default: 'AMUST', uppercase: true, index: true },
    department: { type: String, required: true, uppercase: true, index: true },
    batch: { type: Number, required: true, index: true },
    universityId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'GRADUATED'], default: 'ACTIVE' }
  },

  metadata: {
    isActive: { type: Boolean, default: true },
    lastActiveAt: { type: Date },
    joinedChannels: { type: Number, default: 0 },
    totalCommands: { type: Number, default: 0 },
    commandHistory: [{
      command: String,
      usedAt: { type: Date, default: Date.now }
    }],
    onboardingCompleted: { type: Boolean, default: false }
  },

  preferences: {
    language: { type: String, enum: ['en', 'bn'], default: 'en' },
    dailyReminderEnabled: { type: Boolean, default: true },
    dailyReminderTime: { type: String, default: '06:00' },
    notificationsEnabled: { type: Boolean, default: true }
  }
}, { 
  timestamps: true
});

studentSchema.index({ 'academic.department': 1, 'academic.batch': 1 });
studentSchema.index({ role: 1 });
studentSchema.index({ 'metadata.isActive': 1 });

studentSchema.methods.trackCommand = async function(command) {
  this.metadata.totalCommands = (this.metadata.totalCommands || 0) + 1;
  this.metadata.lastActiveAt = new Date();
  if (!this.metadata.commandHistory) {
    this.metadata.commandHistory = [];
  }
  this.metadata.commandHistory.push({ command, usedAt: new Date() });
  if (this.metadata.commandHistory.length > 50) {
    this.metadata.commandHistory = this.metadata.commandHistory.slice(-50);
  }
  await this.save();
};

export const Student = mongoose.model('Student', studentSchema);
