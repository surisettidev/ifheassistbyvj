// Admin API routes for IFHE Campus Assistant Portal
import { Hono } from 'hono';
import { GoogleSheetsService } from '../lib/sheets';
import { EmailService } from '../lib/email';
import { AuthService, requireAdmin, rateLimit } from '../lib/auth';
import { validateRequired, validateEmail } from '../lib/auth';
import type { CloudflareBindings } from '../types';

const admin = new Hono<{ Bindings: CloudflareBindings }>();

// Apply rate limiting to admin routes
admin.use('*', async (c, next) => {
  const authService = new AuthService(c.env);
  return rateLimit(authService, 30, 60000)(c, next); // 30 requests per minute for admin
});

// POST /api/admin/login - Admin login endpoint
admin.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    
    const validationErrors = [
      validateRequired(body.api_key, 'api_key')
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      return c.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, 400);
    }

    const authService = new AuthService(c.env);
    
    // Validate API key
    if (!authService.validateAdminKey(body.api_key)) {
      return c.json({ 
        error: 'Invalid API key',
        message: 'Access denied'
      }, 401);
    }

    // Create session token
    const sessionToken = await authService.createSessionToken('admin@ifheindia.org');

    return c.json({
      success: true,
      message: 'Login successful',
      token: sessionToken,
      expires_in: 86400, // 24 hours
      user: {
        email: 'admin@ifheindia.org',
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return c.json({ 
      error: 'Login failed',
      message: 'Please try again later'
    }, 500);
  }
});

// All other admin routes require authentication
admin.use('/*', async (c, next) => {
  const authService = new AuthService(c.env);
  return requireAdmin(authService)(c, next);
});

// GET /api/admin/dashboard - Get admin dashboard stats
admin.get('/dashboard', async (c) => {
  try {
    const sheetsService = new GoogleSheetsService(c.env);
    
    // Get basic counts
    const events = await sheetsService.getEvents();
    const notices = await sheetsService.getNotices();
    const chatLogs = await sheetsService.getChatLogs(10); // Last 10 chat logs
    
    // Get registration count
    const registrations = await sheetsService.readRange('registrations');
    const registrationCount = Math.max(0, registrations.length - 1); // Subtract header row

    // Calculate today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayChats = chatLogs.filter(log => 
      log.timestamp.startsWith(today)
    ).length;

    const todayRegistrations = registrations.slice(1).filter(row => 
      row[8] && row[8].startsWith(today)
    ).length;

    // Get model usage stats from chat logs
    const modelStats = {};
    chatLogs.forEach(log => {
      if (log.model_used) {
        modelStats[log.model_used] = (modelStats[log.model_used] || 0) + 1;
      }
    });

    // Get recent errors
    const recentErrors = chatLogs
      .filter(log => log.status === 'error')
      .slice(0, 5);

    return c.json({
      success: true,
      dashboard: {
        overview: {
          total_events: events.length,
          total_notices: notices.length,
          total_registrations: registrationCount,
          total_chat_sessions: chatLogs.length
        },
        today: {
          chats: todayChats,
          registrations: todayRegistrations,
          date: today
        },
        ai_models: {
          usage: modelStats,
          total_queries: chatLogs.length
        },
        recent_activity: {
          latest_chats: chatLogs.slice(0, 5).map(log => ({
            timestamp: log.timestamp,
            question: log.question.substring(0, 100) + (log.question.length > 100 ? '...' : ''),
            model_used: log.model_used,
            status: log.status
          })),
          recent_errors: recentErrors.map(log => ({
            timestamp: log.timestamp,
            question: log.question.substring(0, 100) + (log.question.length > 100 ? '...' : ''),
            error: log.error
          }))
        }
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    return c.json({ 
      error: 'Failed to load dashboard data'
    }, 500);
  }
});

// GET /api/admin/chat-logs - Get chat logs with pagination
admin.get('/chat-logs', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const status = c.req.query('status'); // 'success', 'error', or undefined for all

    const sheetsService = new GoogleSheetsService(c.env);
    let chatLogs = await sheetsService.getChatLogs(Math.min(limit + offset + 50, 500)); // Get extra logs for filtering

    // Filter by status if specified
    if (status) {
      chatLogs = chatLogs.filter(log => log.status === status);
    }

    // Apply pagination
    const paginatedLogs = chatLogs.slice(offset, offset + limit);

    // Calculate stats
    const totalLogs = chatLogs.length;
    const successRate = chatLogs.length > 0 
      ? (chatLogs.filter(log => log.status === 'success').length / chatLogs.length * 100).toFixed(2)
      : 0;

    return c.json({
      success: true,
      logs: paginatedLogs,
      pagination: {
        total: totalLogs,
        offset,
        limit,
        has_more: offset + limit < totalLogs
      },
      stats: {
        success_rate: parseFloat(successRate),
        total_queries: totalLogs,
        error_count: chatLogs.filter(log => log.status === 'error').length
      }
    });

  } catch (error) {
    console.error('Get chat logs error:', error);
    return c.json({ 
      error: 'Failed to fetch chat logs'
    }, 500);
  }
});

// GET /api/admin/analytics - Get analytics data
admin.get('/analytics', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7');
    const sheetsService = new GoogleSheetsService(c.env);
    
    // Get chat logs for analysis
    const chatLogs = await sheetsService.getChatLogs(1000); // Get more logs for analytics
    
    // Date range analysis
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentLogs = chatLogs.filter(log => 
      new Date(log.timestamp) >= cutoffDate
    );

    // Daily activity
    const dailyActivity = {};
    recentLogs.forEach(log => {
      const date = log.timestamp.split('T')[0];
      if (!dailyActivity[date]) {
        dailyActivity[date] = { total: 0, success: 0, error: 0 };
      }
      dailyActivity[date].total++;
      dailyActivity[date][log.status]++;
    });

    // Most asked questions (simplified keyword analysis)
    const questionKeywords = {};
    recentLogs.forEach(log => {
      const words = log.question.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !['what', 'when', 'where', 'how', 'why', 'which', 'about', 'ifhe'].includes(word));
      
      words.forEach(word => {
        questionKeywords[word] = (questionKeywords[word] || 0) + 1;
      });
    });

    const topKeywords = Object.entries(questionKeywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ keyword: word, count }));

    // Model performance
    const modelPerformance = {};
    recentLogs.forEach(log => {
      if (!modelPerformance[log.model_used]) {
        modelPerformance[log.model_used] = { total: 0, success: 0, error: 0 };
      }
      modelPerformance[log.model_used].total++;
      modelPerformance[log.model_used][log.status]++;
    });

    return c.json({
      success: true,
      analytics: {
        period: {
          days,
          start_date: cutoffDate.toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        },
        daily_activity: Object.entries(dailyActivity)
          .map(([date, stats]) => ({ date, ...stats }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        top_keywords: topKeywords,
        model_performance: Object.entries(modelPerformance)
          .map(([model, stats]) => ({
            model,
            ...stats,
            success_rate: stats.total > 0 ? (stats.success / stats.total * 100).toFixed(2) : 0
          })),
        summary: {
          total_queries: recentLogs.length,
          success_rate: recentLogs.length > 0 
            ? (recentLogs.filter(log => log.status === 'success').length / recentLogs.length * 100).toFixed(2)
            : 0,
          avg_queries_per_day: (recentLogs.length / Math.max(days, 1)).toFixed(1)
        }
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return c.json({ 
      error: 'Failed to generate analytics'
    }, 500);
  }
});

// POST /api/admin/test-email - Test email configuration
admin.post('/test-email', async (c) => {
  try {
    const body = await c.req.json();
    const testEmail = body.email || 'admin@ifheindia.org';

    if (!validateEmail(testEmail)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    const emailService = new EmailService(c.env);
    const success = await emailService.testEmailConfig();

    return c.json({
      success,
      message: success 
        ? `Test email sent successfully to ${testEmail}` 
        : 'Failed to send test email. Check SMTP configuration.',
      email: testEmail
    });

  } catch (error) {
    console.error('Test email error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to test email configuration'
    }, 500);
  }
});

// POST /api/admin/broadcast - Send broadcast notification (future feature)
admin.post('/broadcast', async (c) => {
  try {
    const body = await c.req.json();
    
    const validationErrors = [
      validateRequired(body.subject, 'subject'),
      validateRequired(body.message, 'message'),
      validateRequired(body.target, 'target') // 'all', 'students', 'event_registrants'
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      return c.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, 400);
    }

    // This would require implementing broadcast functionality
    return c.json({
      success: false,
      error: 'Broadcast feature not yet implemented',
      message: 'This feature will be available in a future update'
    }, 501);

  } catch (error) {
    console.error('Broadcast error:', error);
    return c.json({ 
      error: 'Failed to send broadcast'
    }, 500);
  }
});

// GET /api/admin/system-status - Get system health status
admin.get('/system-status', async (c) => {
  try {
    const checks = [];
    
    // Test Google Sheets connection
    try {
      const sheetsService = new GoogleSheetsService(c.env);
      await sheetsService.readRange('events', 'A1:A1');
      checks.push({ service: 'Google Sheets', status: 'healthy', message: 'Connected successfully' });
    } catch (error) {
      checks.push({ service: 'Google Sheets', status: 'error', message: error.message });
    }

    // Test AI services
    const aiChecks = [
      { name: 'Gemini API', key: 'GEMINI_API_KEY' },
      { name: 'Groq API', key: 'GROQ_API_KEY' },
      { name: 'OpenRouter API', key: 'OPENROUTER_API_KEY' }
    ];

    aiChecks.forEach(({ name, key }) => {
      const hasKey = !!c.env[key];
      checks.push({
        service: name,
        status: hasKey ? 'configured' : 'missing',
        message: hasKey ? 'API key configured' : 'API key not set'
      });
    });

    // Test email configuration
    const emailConfigured = !!(c.env.SMTP_HOST && c.env.SMTP_USER && c.env.SMTP_PASS);
    checks.push({
      service: 'Email Service',
      status: emailConfigured ? 'configured' : 'missing',
      message: emailConfigured ? 'SMTP configured' : 'SMTP configuration missing'
    });

    const overallStatus = checks.every(check => 
      check.status === 'healthy' || check.status === 'configured'
    ) ? 'healthy' : 'degraded';

    return c.json({
      success: true,
      overall_status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    });

  } catch (error) {
    console.error('System status error:', error);
    return c.json({ 
      overall_status: 'error',
      error: 'Failed to check system status'
    }, 500);
  }
});

export { admin };