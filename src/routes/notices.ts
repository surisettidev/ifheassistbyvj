// Notices API routes for IFHE Campus Assistant Portal
import { Hono } from 'hono';
import { GoogleSheetsService } from '../lib/sheets';
import { AuthService, requireAdmin, rateLimit } from '../lib/auth';
import { validateRequired, sanitizeHtml } from '../lib/auth';
import type { CloudflareBindings, Notice } from '../types';

const notices = new Hono<{ Bindings: CloudflareBindings }>();

// Apply rate limiting
notices.use('*', async (c, next) => {
  const authService = new AuthService(c.env);
  return rateLimit(authService, 20, 60000)(c, next); // 20 requests per minute
});

// GET /api/notices - Get all visible notices
notices.get('/', async (c) => {
  try {
    const sheetsService = new GoogleSheetsService(c.env);
    const noticesData = await sheetsService.getNotices();
    
    return c.json({
      success: true,
      notices: noticesData,
      count: noticesData.length
    });

  } catch (error) {
    console.error('Get notices error:', error);
    return c.json({ 
      error: 'Failed to fetch notices',
      notices: [],
      count: 0
    }, 500);
  }
});

// GET /api/notices/:id - Get specific notice
notices.get('/:id', async (c) => {
  try {
    const noticeId = c.req.param('id');
    const sheetsService = new GoogleSheetsService(c.env);
    const noticesData = await sheetsService.getNotices();
    
    const notice = noticesData.find(n => n.id === noticeId);
    
    if (!notice) {
      return c.json({ error: 'Notice not found' }, 404);
    }

    return c.json({
      success: true,
      notice
    });

  } catch (error) {
    console.error('Get notice error:', error);
    return c.json({ 
      error: 'Failed to fetch notice'
    }, 500);
  }
});

// GET /api/notices/category/:category - Get notices by category
notices.get('/category/:category', async (c) => {
  try {
    const category = c.req.param('category').toLowerCase();
    const sheetsService = new GoogleSheetsService(c.env);
    const noticesData = await sheetsService.getNotices();
    
    const filteredNotices = noticesData.filter(notice => 
      notice.category.toLowerCase() === category ||
      notice.category.toLowerCase().includes(category)
    );
    
    return c.json({
      success: true,
      notices: filteredNotices,
      category,
      count: filteredNotices.length
    });

  } catch (error) {
    console.error('Get notices by category error:', error);
    return c.json({ 
      error: 'Failed to fetch notices',
      notices: [],
      count: 0
    }, 500);
  }
});

// GET /api/notices/recent/:days - Get notices from last N days
notices.get('/recent/:days', async (c) => {
  try {
    const days = parseInt(c.req.param('days')) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const sheetsService = new GoogleSheetsService(c.env);
    const noticesData = await sheetsService.getNotices();
    
    const recentNotices = noticesData.filter(notice => 
      new Date(notice.posted_at_iso) >= cutoffDate
    );
    
    return c.json({
      success: true,
      notices: recentNotices,
      days,
      count: recentNotices.length
    });

  } catch (error) {
    console.error('Get recent notices error:', error);
    return c.json({ 
      error: 'Failed to fetch recent notices',
      notices: [],
      count: 0
    }, 500);
  }
});

// Admin routes - require authentication
notices.use('/admin/*', async (c, next) => {
  const authService = new AuthService(c.env);
  return requireAdmin(authService)(c, next);
});

// POST /api/notices/admin - Create new notice (admin only)
notices.post('/admin', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate required fields
    const validationErrors = [
      validateRequired(body.title, 'title'),
      validateRequired(body.body_html, 'body_html'),
      validateRequired(body.category, 'category')
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      return c.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, 400);
    }

    // Sanitize HTML content
    const sanitizedBody = sanitizeHtml(body.body_html);

    // Validate category
    const allowedCategories = [
      'General', 'Academic', 'Events', 'Placements', 
      'Admissions', 'Sports', 'Clubs', 'Facilities', 
      'Announcements', 'Urgent'
    ];

    const category = body.category.trim();
    if (!allowedCategories.includes(category)) {
      return c.json({ 
        error: `Invalid category. Allowed categories: ${allowedCategories.join(', ')}` 
      }, 400);
    }

    const newNotice: Omit<Notice, 'id' | 'created_at'> = {
      title: body.title.trim(),
      body_html: sanitizedBody,
      category: category,
      posted_at_iso: body.posted_at_iso || new Date().toISOString(),
      visible: body.visible !== false // Default to true
    };

    const sheetsService = new GoogleSheetsService(c.env);
    await sheetsService.createNotice(newNotice);

    return c.json({
      success: true,
      message: 'Notice created successfully',
      notice: newNotice
    });

  } catch (error) {
    console.error('Create notice error:', error);
    return c.json({ 
      error: 'Failed to create notice',
      message: 'Please try again later'
    }, 500);
  }
});

// PUT /api/notices/admin/:id - Update notice (admin only)
notices.put('/admin/:id', async (c) => {
  try {
    const noticeId = c.req.param('id');
    const body = await c.req.json();
    
    // This would require implementing update functionality in GoogleSheetsService
    // For now, return a placeholder response
    return c.json({
      success: false,
      error: 'Notice updates not yet implemented',
      message: 'Please create a new notice instead'
    }, 501);

  } catch (error) {
    console.error('Update notice error:', error);
    return c.json({ 
      error: 'Failed to update notice'
    }, 500);
  }
});

// DELETE /api/notices/admin/:id - Delete notice (admin only)
notices.delete('/admin/:id', async (c) => {
  try {
    const noticeId = c.req.param('id');
    
    // This would require implementing delete functionality in GoogleSheetsService
    // For now, return a placeholder response
    return c.json({
      success: false,
      error: 'Notice deletion not yet implemented',
      message: 'Please set notice visibility to false instead'
    }, 501);

  } catch (error) {
    console.error('Delete notice error:', error);
    return c.json({ 
      error: 'Failed to delete notice'
    }, 500);
  }
});

// GET /api/notices/admin/all - Get all notices including hidden ones (admin only)
notices.get('/admin/all', async (c) => {
  try {
    const sheetsService = new GoogleSheetsService(c.env);
    
    // Read all notices from sheet including hidden ones
    const rows = await sheetsService.readRange('notices');
    
    if (rows.length <= 1) {
      return c.json({
        success: true,
        notices: [],
        count: 0
      });
    }

    const allNotices: Notice[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0) continue;

      const notice: Notice = {
        id: row[0] || `notice_${i}`,
        title: row[1] || '',
        body_html: row[2] || '',
        category: row[3] || 'General',
        posted_at_iso: row[4] || new Date().toISOString(),
        visible: row[5] === 'TRUE' || row[5] === true,
        created_at: row[6] || new Date().toISOString()
      };

      allNotices.push(notice);
    }

    // Sort by posted date, newest first
    allNotices.sort((a, b) => new Date(b.posted_at_iso).getTime() - new Date(a.posted_at_iso).getTime());

    return c.json({
      success: true,
      notices: allNotices,
      count: allNotices.length
    });

  } catch (error) {
    console.error('Get admin notices error:', error);
    return c.json({ 
      error: 'Failed to fetch notices'
    }, 500);
  }
});

// GET /api/notices/categories - Get all available categories
notices.get('/categories', async (c) => {
  try {
    const sheetsService = new GoogleSheetsService(c.env);
    const noticesData = await sheetsService.getNotices();
    
    // Extract unique categories
    const categories = [...new Set(noticesData.map(notice => notice.category))];
    
    // Count notices per category
    const categoryCounts = categories.map(category => ({
      name: category,
      count: noticesData.filter(notice => notice.category === category).length
    }));

    return c.json({
      success: true,
      categories: categoryCounts,
      total: categories.length
    });

  } catch (error) {
    console.error('Get categories error:', error);
    return c.json({ 
      error: 'Failed to fetch categories',
      categories: []
    }, 500);
  }
});

export { notices };