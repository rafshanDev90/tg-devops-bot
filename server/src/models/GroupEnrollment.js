// src/models/GroupEnrollment.js
import mongoose from 'mongoose';

// Normalizing groups handles multi-student chat spaces cleanly
const groupEnrollmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  groupId: { type: String, required: true },
  groupName: { type: String, required: true },
  platform: { type: String, enum: ['WHATSAPP', 'TELEGRAM'], required: true }
}, { timestamps: true });

groupEnrollmentSchema.index({ studentId: 1, groupId: 1 }, { unique: true });

export const GroupEnrollment = mongoose.model('GroupEnrollment', groupEnrollmentSchema);
