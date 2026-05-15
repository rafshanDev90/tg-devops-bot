// src/models/AssignmentStatus.js
import mongoose from 'mongoose';

// Moving assignments to a separate collection prevents document bloating
const assignmentStatusSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  title: { type: String, required: true, trim: true },
  dueDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'SUBMITTED', 'GRADED', 'LATE'], 
    default: 'PENDING',
    required: true 
  },
  submittedAt: { type: Date }
}, { timestamps: true });

// Compound index for fetching a specific student's pending assignments quickly
assignmentStatusSchema.index({ studentId: 1, status: 1 });

export const AssignmentStatus = mongoose.model('AssignmentStatus', assignmentStatusSchema);
