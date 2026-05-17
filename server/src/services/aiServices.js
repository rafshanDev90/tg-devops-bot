// src/services/aiService.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export class AIService {
  constructor() {
    // Ensure your .env file has GEMINI_API_KEY and GROQ_API_KEY set
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // Initialize models synchronously to prevent null pointer exceptions
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  
  async generateResponse(prompt, context = {}) {
    try {
      const enhancedPrompt = this.buildPrompt(prompt, context);
      const result = await this.model.generateContent(enhancedPrompt);
      return result.response.text();
    } catch (error) {
      console.error('Gemini API Error, falling back to Groq:', error.message || error);
      return this.getGroqFallback(prompt, context);
    }
  }

  async generateResponseFromImage(imageBuffer, prompt) {
    try {
      // Reuses the pre-initialized vision model instance
      const result = await this.visionModel.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg',
          },
        },
      ]);
      return result.response.text();
    } catch (error) {
      console.error('Gemini Vision API Error:', error.message || error);
      const errorsMod = await import('../utils/errors.js');
      throw new errorsMod.AIError('Failed to process image with AI', { originalError: error.message });
    }
  }
  
  buildPrompt(userQuery, context) {
    return `
You are an AI assistant for university students.
Context: ${JSON.stringify(context)}
Student Query: ${userQuery}

Provide helpful, accurate, and educational responses.
IMPORTANT FORMATTING RULES:
1. Do NOT write massive walls of text. Keep your response extremely concise (under 200 words).
2. Use bullet points, emojis, and short paragraphs to make it highly readable on a mobile screen.
3. Break down complex topics into bite-sized, easy-to-digest pieces.
4. Format with proper markdown for code blocks, lists, and emphasis.
`;
  }

  async getGroqFallback(prompt, context) {
    try {
      const enhancedPrompt = this.buildPrompt(prompt, context);
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: "user", content: enhancedPrompt }],
        model: "llama-3.3-70b-versatile", 
      });
      return completion.choices[0]?.message?.content || this.getStaticFallbackResponse();
    } catch (groqError) {
      console.error('Groq Fallback Error:', groqError.message || groqError);
      return this.getStaticFallbackResponse();
    }
  }
  
  getStaticFallbackResponse() {
    return `দুঃখিত, এই মুহূর্তে সার্ভার লোড বেশি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা আপনার শিক্ষকের সাথে যোগাযোগ করুন।`;
  }
}
