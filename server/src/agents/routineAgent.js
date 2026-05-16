import { AIError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `You are a routine parser for a university student in Bangladesh (CSE department).

Parse the following routine text into structured JSON. The routine may be in any format: table, list, messy text, image OCR output, or Bengali/English mixed.

Extract for each class:
- day_of_week: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, or Sunday
- start_time: HH:MM in 24-hour format (e.g., "08:00", "14:30")
- end_time: HH:MM in 24-hour format
- subject_name: Full subject name
- teacher_name: Teacher name, or null if not found
- room_number: Room/lab number, or null if not found
- is_lab: true if subject contains "Lab", "Practical", "Session", or similar

Rules:
- If time is in AM/PM, convert to 24-hour format
- If a class spans a break (e.g., 10:00-11:30 with 15min break), keep original times
- If day is abbreviated (Mon, Tue), expand to full name
- If the same subject appears multiple times on different days, create separate entries
- Return ONLY a valid JSON array. No markdown, no explanation, no code blocks.

Example output:
[{"day_of_week":"Monday","start_time":"08:00","end_time":"09:00","subject_name":"Data Structures","teacher_name":"Dr. Rahman","room_number":"301","is_lab":false}]`;

export class RoutineAgent {
  constructor(aiService) {
    this.aiService = aiService;
  }

  async parseRoutine(text) {
    if (!text || text.trim().length < 5) {
      throw new AIError('Routine text is too short to parse', { textLength: text?.length || 0 });
    }

    // Optimization: If text is already a JSON array, just validate it
    if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(text.trim());
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].day_of_week) {
          logger.info('RoutineAgent', 'Detected pre-parsed JSON, skipping AI call');
          return parsed.map((entry, i) => this._validateEntry(entry, i));
        }
      } catch (e) {
        // Not valid JSON, continue to AI parsing
      }
    }

    try {
      const prompt = `${SYSTEM_PROMPT}\n\nRoutine text to parse:\n${text}`;
      const response = await this.aiService.generateResponse(prompt, { task: 'routine_parsing' });
      const cleaned = this._extractJSON(response);
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new AIError('AI returned non-array response', { responseType: typeof parsed });
      }

      const validated = parsed.map((entry, i) => this._validateEntry(entry, i));
      logger.info('RoutineAgent', `Parsed ${validated.length} classes from routine`);
      return validated;
    } catch (error) {
      if (error.isOperational) throw error;
      logger.error('RoutineAgent', 'Parsing failed', { error: error.message, text: text.substring(0, 100) });
      throw new AIError('Failed to parse routine with AI', { originalError: error.message });
    }
  }

  _extractJSON(text) {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    return match ? match[0] : cleaned;
  }

  _validateEntry(entry, index) {
    const required = ['day_of_week', 'start_time', 'end_time', 'subject_name'];
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (const field of required) {
      if (!entry[field]) {
        throw new AIError(`Missing required field "${field}" in entry ${index}`, { entry });
      }
    }

    if (!validDays.includes(entry.day_of_week)) {
      throw new AIError(`Invalid day "${entry.day_of_week}" in entry ${index}`, { entry });
    }

    if (!/^\d{2}:\d{2}$/.test(entry.start_time) || !/^\d{2}:\d{2}$/.test(entry.end_time)) {
      throw new AIError(`Invalid time format in entry ${index}`, { entry });
    }

    return {
      day_of_week: entry.day_of_week,
      start_time: entry.start_time,
      end_time: entry.end_time,
      subject_name: entry.subject_name.trim(),
      teacher_name: entry.teacher_name || null,
      room_number: entry.room_number || null,
      is_lab: Boolean(entry.is_lab),
    };
  }
}
