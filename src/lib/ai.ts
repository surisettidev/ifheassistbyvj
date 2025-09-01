// Multi-AI fallback service for IFHE Campus Assistant
import type { CloudflareBindings, ChatResponse, SearchResult } from '../types';

export class AIService {
  private env: CloudflareBindings;

  constructor(env: CloudflareBindings) {
    this.env = env;
  }

  // Get context from Google Custom Search (restricted to IFHE domain)
  async getIFHEContext(query: string): Promise<SearchResult[]> {
    if (!this.env.GOOGLE_CSE_ID || !this.env.GOOGLE_CSE_API_KEY) {
      return [];
    }

    try {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.env.GOOGLE_CSE_API_KEY}&cx=${this.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query + ' site:ifheindia.org')}&num=5`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.items) {
        return data.items.map((item: any) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet
        }));
      }
      return [];
    } catch (error) {
      console.error('Google CSE Error:', error);
      return [];
    }
  }

  // Try Gemini API first
  async askGemini(question: string, context: string): Promise<string | null> {
    if (!this.env.GEMINI_API_KEY) return null;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${this.getSystemPrompt()}\n\nContext from IFHE website:\n${context}\n\nQuestion: ${question}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        }),
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      }
      
      return null;
    } catch (error) {
      console.error('Gemini API Error:', error);
      return null;
    }
  }

  // Fallback to Groq API
  async askGroq(question: string, context: string): Promise<string | null> {
    if (!this.env.GROQ_API_KEY) return null;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-r1-distill-llama-70b',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: `Context from IFHE website:\n${context}\n\nQuestion: ${question}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }
      
      return null;
    } catch (error) {
      console.error('Groq API Error:', error);
      return null;
    }
  }

  // Final fallback to OpenRouter
  async askOpenRouter(question: string, context: string): Promise<string | null> {
    if (!this.env.OPENROUTER_API_KEY) return null;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.env.APP_BASE_URL || 'https://ifhe-campus-assistant.pages.dev',
          'X-Title': 'IFHE Campus Assistant',
        },
        body: JSON.stringify({
          model: 'qwen/qwen2.5-14b-instruct',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: `Context from IFHE website:\n${context}\n\nQuestion: ${question}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }
      
      return null;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      return null;
    }
  }

  // Main function with fallback logic
  async answer(question: string): Promise<{ response: string; model: string; sourceLinks: SearchResult[] }> {
    // Get context from IFHE website
    const searchResults = await this.getIFHEContext(question);
    const context = searchResults.map(r => `${r.title}: ${r.snippet}`).join('\n');

    // Try each AI model in sequence
    let response: string | null = null;
    let modelUsed = '';

    // Try Gemini first
    response = await this.askGemini(question, context);
    if (response) {
      modelUsed = 'gemini-1.5-flash';
    } else {
      // Fallback to Groq
      response = await this.askGroq(question, context);
      if (response) {
        modelUsed = 'deepseek-r1-distill-llama-70b';
      } else {
        // Final fallback to OpenRouter
        response = await this.askOpenRouter(question, context);
        if (response) {
          modelUsed = 'qwen2.5-14b-instruct';
        }
      }
    }

    if (!response) {
      return {
        response: this.getErrorMessage(),
        model: 'none',
        sourceLinks: searchResults
      };
    }

    return {
      response,
      model: modelUsed,
      sourceLinks: searchResults
    };
  }

  // Format response as HTML
  formatHTML(text: string, sourceLinks: SearchResult[]): string {
    // Convert basic markdown to HTML
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      .replace(/`(.*?)`/g, '<code>$1</code>');

    // Add useful links section
    if (sourceLinks.length > 0) {
      html += '<br><br><strong>📚 Useful Links:</strong><ul>';
      sourceLinks.forEach(link => {
        html += `<li><a href="${link.link}" target="_blank" rel="noopener noreferrer">${link.title}</a></li>`;
      });
      html += '</ul>';
    }

    // Add disclaimer
    html += '<br><br><small><em>💡 This information is generated by AI and may not be completely accurate. For official information, please verify with IFHE administration or check the official website.</em></small>';

    return html;
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant for IFHE (Indian School of Business & Finance) Hyderabad campus. You should ONLY answer questions related to IFHE Hyderabad, its programs, admissions, campus life, facilities, faculty, events, and student services.

Key information about IFHE:
- Full name: Indian School of Business & Finance (IFHE) Hyderabad
- Programs: MBA, BBA, B.Com, M.Com, PhD programs
- Campus located in Hyderabad, India
- Focus on business, finance, and management education
- Strong industry connections and placement support

Guidelines:
1. Answer ONLY about IFHE Hyderabad - politely decline questions about other topics
2. Be helpful, accurate, and informative
3. If you don't know specific details, suggest contacting IFHE administration
4. Provide practical advice for prospective and current students
5. Keep responses concise but comprehensive
6. Use a friendly, professional tone suitable for students

If asked about topics unrelated to IFHE, respond: "I'm specifically designed to help with questions about IFHE Hyderabad. Please ask me about admissions, programs, campus facilities, or student services at IFHE."`;
  }

  private getErrorMessage(): string {
    return `I apologize, but I'm currently unable to process your question due to technical issues. Please try again in a moment or contact IFHE administration directly for immediate assistance.

🏫 **IFHE Hyderabad Contact:**
- Website: https://ifheindia.org
- Phone: +91-40-xxxx-xxxx
- Email: info@ifheindia.org

<small><em>Our AI assistant will be back online shortly. Thank you for your patience!</em></small>`;
  }
}