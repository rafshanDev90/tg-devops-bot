// src/agents/studyAgent.js
export class StudyAgent {
  constructor(aiService) {
    this.aiService = aiService;
    this.subjects = ['DSA', 'DBMS', 'OS', 'CN', 'Maths'];
  }
  
  async answerQuestion(question, studentId) {
    const prompt = `
Student Question: ${question}

Provide a clear, educational response covering:
1. Core concept explanation
2. Example if applicable
3. Common pitfalls to avoid
4. Practice suggestion

For coding questions, include code examples.
`;
    
    const response = await this.aiService.generateResponse(prompt, {
      studentId,
      subjects: this.subjects,
      academicLevel: '2nd Year CSE'
    });
    
    return response + '\n\n📚 *Need more help?* Just ask another question!';
  }
}