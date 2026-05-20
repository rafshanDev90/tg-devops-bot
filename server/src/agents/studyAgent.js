// src/agents/studyAgent.js
import { searchService } from '../services/searchService.js';

export class StudyAgent {
  constructor(aiService) {
    this.aiService = aiService;
  }

  /**
   * @param {string} question
   * @param {string} studentId
   * @param {boolean} useSearch - force web search (e.g. user prefixed with "search:")
   */
  async answerQuestion(question, studentId, useSearch = false) {
    let webContext = null;

    // Auto-trigger search for PyTorch/ML questions or explicit request
    const searchTrigger = useSearch || /pytorch|torch|cuda|llm|transformer|model|train|dataset/i.test(question);
    if (searchTrigger) {
      webContext = await searchService.search(question);
    }

    const prompt = webContext
      ? `You are an AI assistant for university students.\n\n` +
        `--- Web Search Results ---\n${webContext}\n--- End of Results ---\n\n` +
        `Using the above search results as context, answer this question concisely:\n${question}`
      : `Student Question: ${question}\n\nProvide a clear, educational response. ` +
        `Include code examples for coding questions. Keep it under 200 words.`;

    const response = await this.aiService.generateResponse(prompt, { studentId });
    const suffix = webContext ? '\n\n🌐 <i>Answer enhanced with live web search.</i>' : '';
    return response + suffix;
  }
}
