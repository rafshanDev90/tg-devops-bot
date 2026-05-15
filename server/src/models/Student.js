// src/models/Student.js
import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  telegramId: { 
    type: Number, 
    required: true, 
    unique: true,
    index: true // High-cardinality index for rapid lookups
  },
  name: { type: String, required: true, trim: true },
  username: { type: String, trim: true },
  
  // Structured academic data
  academic: {
    year: { type: Number, required: true, min: 1, max: 5 },
    branch: { type: String, required: true, uppercase: true, index: true },
    rollNumber: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'GRADUATED'], default: 'ACTIVE' }
  },

  // Metadata
  metadata: {
    isActive: { type: Boolean, default: true },
    lastActiveAt: { type: Date }
  }
}, { 
  timestamps: true // Automatically handles createdAt and updatedAt
});

// Compound index for academic filtering (e.g., pulling all CS year 3 students)
studentSchema.index({ 'academic.branch': 1, 'academic.year': 1 });

export const Student = mongoose.model('Student', studentSchema);
