// Chat API route for IFHE Campus Assistant Portal
import { Hono } from 'hono';
import { AIService } from '../lib/ai';
import { GoogleSheetsService } from '../lib/sheets';
import { AuthService, rateLimit } from '../lib/auth';
import { validateEmail, validateRequired } from '../lib/auth';
import type { CloudflareBindings, ChatRequest, ChatResponse, ChatLog } from '../types';

const chat = new Hono<{ Bindings: CloudflareBindings }>();

// Apply rate limiting to chat endpoint
chat.use('*', async (c, next) => {
  const authService = new AuthService(c.env);
  return rateLimit(authService, 5, 60000)(c, next); // 5 requests per minute
});

// POST /api/chat - Main chat endpoint with AI fallback
chat.post('/', async (c) => {
  try {
    const body = await c.req.json() as ChatRequest;
    
    // Validate required fields
    const questionError = validateRequired(body.question, 'question');
    if (questionError) {
      return c.json({ error: questionError }, 400);
    }

    // Validate email if provided
    if (body.user_email && !validateEmail(body.user_email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Sanitize inputs
    const question = body.question.trim();
    const user_email = body.user_email?.trim() || null;
    const user_name = body.user_name?.trim() || null;

    if (question.length > 500) {
      return c.json({ error: 'Question is too long (max 500 characters)' }, 400);
    }

    // Initialize services
    const aiService = new AIService(c.env);
    const sheetsService = new GoogleSheetsService(c.env);
    
    const timestamp = new Date().toISOString();
    let chatLog: ChatLog = {
      timestamp,
      user_email,
      user_name,
      question,
      model_used: '',
      status: 'error',
      final_answer_html: ''
    };

    try {
      // Get AI response with fallback logic
      const aiResult = await aiService.answer(question);
      
      // Format response as HTML
      const htmlResponse = aiService.formatHTML(aiResult.response, aiResult.sourceLinks);
      
      // Prepare successful response
      const response: ChatResponse = {
        html: htmlResponse,
        model_used: aiResult.model,
        timestamp,
        source_links: aiResult.sourceLinks.map(link => link.link)
      };

      // Update chat log for success
      chatLog.model_used = aiResult.model;
      chatLog.status = 'success';
      chatLog.raw_response = aiResult.response;
      chatLog.final_answer_html = htmlResponse;
      chatLog.source_links = JSON.stringify(aiResult.sourceLinks);

      // Log to Google Sheets (non-blocking)
      sheetsService.logChat(chatLog).catch(error => {
        console.error('Failed to log chat:', error);
      });

      return c.json(response);

    } catch (aiError) {
      console.error('AI Service Error:', aiError);
      
      // Prepare error response
      const errorMessage = `I apologize, but I'm experiencing technical difficulties right now. Please try again in a moment, or contact IFHE administration directly.

🏫 **IFHE Hyderabad Contact:**
- Website: https://ifheindia.org
- Email: info@ifheindia.org

<small><em>Technical support will resolve this issue shortly. Thank you for your patience!</em></small>`;

      const response: ChatResponse = {
        html: errorMessage,
        model_used: 'none',
        timestamp
      };

      // Update chat log for error
      chatLog.error = aiError instanceof Error ? aiError.message : 'Unknown error';
      chatLog.final_answer_html = errorMessage;

      // Log error to Google Sheets (non-blocking)
      sheetsService.logChat(chatLog).catch(error => {
        console.error('Failed to log chat error:', error);
      });

      return c.json(response);
    }

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return c.json({ 
      error: 'Internal server error', 
      message: 'Please try again later' 
    }, 500);
  }
});

// GET /api/chat/test - Test endpoint for health check
chat.get('/test', async (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'IFHE Campus Assistant Chat API is running',
    timestamp: new Date().toISOString()
  });
});

// POST /api/chat/feedback - Submit feedback about AI response
chat.post('/feedback', async (c) => {
  try {
    const body = await c.req.json();
    
    const rating = body.rating; // 1-5 stars
    const feedback = body.feedback;
    const question = body.question;
    const user_email = body.user_email;

    if (!rating || rating < 1 || rating > 5) {
      return c.json({ error: 'Rating must be between 1 and 5' }, 400);
    }

    // Log feedback to sheets (you could create a separate feedback sheet)
    const sheetsService = new GoogleSheetsService(c.env);
    
    // For now, log as a special chat entry
    const feedbackLog: ChatLog = {
      timestamp: new Date().toISOString(),
      user_email,
      user_name: 'Feedback',
      question: `FEEDBACK (${rating}/5): ${question}`,
      model_used: 'feedback',
      status: 'success',
      final_answer_html: feedback || 'No additional feedback',
      source_links: `Rating: ${rating}/5`
    };

    await sheetsService.logChat(feedbackLog);

    return c.json({ 
      success: true, 
      message: 'Thank you for your feedback!' 
    });

  } catch (error) {
    console.error('Feedback endpoint error:', error);
    return c.json({ 
      error: 'Failed to submit feedback', 
      message: 'Please try again later' 
    }, 500);
  }
});

export { chat };