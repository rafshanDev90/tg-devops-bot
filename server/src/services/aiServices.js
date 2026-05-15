// src/services/aiService.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export class AIService {
  constructor() {
    // Initialize free AI models
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.model = null;
    this.initModel();
  }
  
  async initModel() {
    // Use Gemini (free tier)
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }
  
  async generateResponse(prompt, context = {}) {
    try {
      const enhancedPrompt = this.buildPrompt(prompt, context);
      const result = await this.model.generateContent(enhancedPrompt);
      return result.response.text();
    } catch (error) {
      console.error('AI Error:', error);
      return this.getFallbackResponse(prompt);
    }
  }
  
  buildPrompt(userQuery, context) {
    return `
You are an AI assistant for CSE 2nd year students.
Context: ${JSON.stringify(context)}
Student Query: ${userQuery}

Provide helpful, accurate, and educational responses.
Format with proper markdown for code blocks, lists, and emphasis.
`;
  }
  
  getFallbackResponse(query) {
    return `I'm having trouble processing that right now. Could you rephrase or try again later? Meanwhile, check your class notes or ask your professor.`;
  }
}