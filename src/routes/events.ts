// Events API routes for IFHE Campus Assistant Portal
import { Hono } from 'hono';
import { GoogleSheetsService } from '../lib/sheets';
import { AuthService, requireAdmin, rateLimit } from '../lib/auth';
import { validateRequired, sanitizeHtml } from '../lib/auth';
import type { CloudflareBindings, Event } from '../types';

const events = new Hono<{ Bindings: CloudflareBindings }>();

// Apply rate limiting
events.use('*', async (c, next) => {
  const authService = new AuthService(c.env);
  return rateLimit(authService, 20, 60000)(c, next); // 20 requests per minute
});

// GET /api/events - Get all visible events
events.get('/', async (c) => {
  try {
    const sheetsService = new GoogleSheetsService(c.env);
    const eventsData = await sheetsService.getEvents();
    
    return c.json({
      success: true,
      events: eventsData,
      count: eventsData.length
    });

  } catch (error) {
    console.error('Get events error:', error);
    return c.json({ 
      error: 'Failed to fetch events',
      events: [],
      count: 0
    }, 500);
  }
});

// GET /api/events/:id - Get specific event
events.get('/:id', async (c) => {
  try {
    const eventId = c.req.param('id');
    const sheetsService = new GoogleSheetsService(c.env);
    const eventsData = await sheetsService.getEvents();
    
    const event = eventsData.find(e => e.id === eventId);
    
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    return c.json({
      success: true,
      event
    });

  } catch (error) {
    console.error('Get event error:', error);
    return c.json({ 
      error: 'Failed to fetch event'
    }, 500);
  }
});

// GET /api/events/category/:category - Get events by category (if you add categories later)
events.get('/category/:category', async (c) => {
  try {
    const category = c.req.param('category');
    const sheetsService = new GoogleSheetsService(c.env);
    const eventsData = await sheetsService.getEvents();
    
    // Filter by category if you add this field to events
    const filteredEvents = eventsData.filter(event => 
      event.title.toLowerCase().includes(category.toLowerCase()) ||
      event.description.toLowerCase().includes(category.toLowerCase())
    );
    
    return c.json({
      success: true,
      events: filteredEvents,
      category,
      count: filteredEvents.length
    });

  } catch (error) {
    console.error('Get events by category error:', error);
    return c.json({ 
      error: 'Failed to fetch events',
      events: [],
      count: 0
    }, 500);
  }
});

// Admin routes - require authentication
events.use('/admin/*', async (c, next) => {
  const authService = new AuthService(c.env);
  return requireAdmin(authService)(c, next);
});

// POST /api/events/admin - Create new event (admin only)
events.post('/admin', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate required fields
    const validationErrors = [
      validateRequired(body.title, 'title'),
      validateRequired(body.description, 'description'),
      validateRequired(body.date_iso, 'date_iso'),
      validateRequired(body.location, 'location')
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      return c.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, 400);
    }

    // Validate date format
    const eventDate = new Date(body.date_iso);
    if (isNaN(eventDate.getTime())) {
      return c.json({ error: 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SSZ)' }, 400);
    }

    // Check if event is in the future
    if (eventDate < new Date()) {
      return c.json({ error: 'Event date must be in the future' }, 400);
    }

    // Sanitize HTML content
    const sanitizedDescription = sanitizeHtml(body.description);

    const newEvent: Omit<Event, 'id' | 'created_at'> = {
      title: body.title.trim(),
      description: sanitizedDescription,
      date_iso: body.date_iso,
      location: body.location.trim(),
      rsvp_form: body.rsvp_form?.trim() || '',
      visible: body.visible !== false // Default to true
    };

    const sheetsService = new GoogleSheetsService(c.env);
    await sheetsService.createEvent(newEvent);

    return c.json({
      success: true,
      message: 'Event created successfully',
      event: newEvent
    });

  } catch (error) {
    console.error('Create event error:', error);
    return c.json({ 
      error: 'Failed to create event',
      message: 'Please try again later'
    }, 500);
  }
});

// PUT /api/events/admin/:id - Update event (admin only)
events.put('/admin/:id', async (c) => {
  try {
    const eventId = c.req.param('id');
    const body = await c.req.json();
    
    // This would require implementing update functionality in GoogleSheetsService
    // For now, return a placeholder response
    return c.json({
      success: false,
      error: 'Event updates not yet implemented',
      message: 'Please create a new event instead'
    }, 501);

  } catch (error) {
    console.error('Update event error:', error);
    return c.json({ 
      error: 'Failed to update event'
    }, 500);
  }
});

// DELETE /api/events/admin/:id - Delete event (admin only)
events.delete('/admin/:id', async (c) => {
  try {
    const eventId = c.req.param('id');
    
    // This would require implementing delete functionality in GoogleSheetsService
    // For now, return a placeholder response
    return c.json({
      success: false,
      error: 'Event deletion not yet implemented',
      message: 'Please set event visibility to false instead'
    }, 501);

  } catch (error) {
    console.error('Delete event error:', error);
    return c.json({ 
      error: 'Failed to delete event'
    }, 500);
  }
});

// GET /api/events/admin/all - Get all events including hidden ones (admin only)
events.get('/admin/all', async (c) => {
  try {
    const sheetsService = new GoogleSheetsService(c.env);
    
    // Read all events from sheet including hidden ones
    const rows = await sheetsService.readRange('events');
    
    if (rows.length <= 1) {
      return c.json({
        success: true,
        events: [],
        count: 0
      });
    }

    const allEvents: Event[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0) continue;

      const event: Event = {
        id: row[0] || `event_${i}`,
        title: row[1] || '',
        description: row[2] || '',
        date_iso: row[3] || '',
        location: row[4] || '',
        rsvp_form: row[5] || '',
        visible: row[6] === 'TRUE' || row[6] === true,
        created_at: row[7] || new Date().toISOString()
      };

      allEvents.push(event);
    }

    // Sort by creation date, newest first
    allEvents.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());

    return c.json({
      success: true,
      events: allEvents,
      count: allEvents.length
    });

  } catch (error) {
    console.error('Get admin events error:', error);
    return c.json({ 
      error: 'Failed to fetch events'
    }, 500);
  }
});

export { events };