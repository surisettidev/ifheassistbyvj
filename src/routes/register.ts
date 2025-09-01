// Registration API routes for IFHE Campus Assistant Portal
import { Hono } from 'hono';
import { GoogleSheetsService } from '../lib/sheets';
import { EmailService } from '../lib/email';
import { AuthService, requireAdmin, rateLimit } from '../lib/auth';
import { validateRequired, validateEmail } from '../lib/auth';
import type { CloudflareBindings, Registration, Event } from '../types';

const register = new Hono<{ Bindings: CloudflareBindings }>();

// Apply rate limiting
register.use('*', async (c, next) => {
  const authService = new AuthService(c.env);
  return rateLimit(authService, 10, 60000)(c, next); // 10 requests per minute
});

// POST /api/register - Register for an event
register.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate required fields
    const validationErrors = [
      validateRequired(body.event_id, 'event_id'),
      validateRequired(body.name, 'name'),
      validateRequired(body.email, 'email')
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      return c.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, 400);
    }

    // Validate email format
    if (!validateEmail(body.email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Validate name length
    if (body.name.trim().length < 2) {
      return c.json({ error: 'Name must be at least 2 characters long' }, 400);
    }

    // Validate phone number if provided
    if (body.phone && body.phone.trim().length > 0) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(body.phone.trim())) {
        return c.json({ error: 'Invalid phone number format' }, 400);
      }
    }

    const sheetsService = new GoogleSheetsService(c.env);
    const emailService = new EmailService(c.env);

    // Check if event exists and is visible
    const events = await sheetsService.getEvents();
    const event = events.find(e => e.id === body.event_id);

    if (!event) {
      return c.json({ error: 'Event not found or not available for registration' }, 404);
    }

    // Check if event is still in the future
    const eventDate = new Date(event.date_iso);
    const now = new Date();
    
    if (eventDate <= now) {
      return c.json({ error: 'Registration is closed. This event has already started or ended.' }, 400);
    }

    // Check if registration deadline has passed (assuming 1 hour before event)
    const registrationDeadline = new Date(eventDate.getTime() - (60 * 60 * 1000)); // 1 hour before
    if (now >= registrationDeadline) {
      return c.json({ error: 'Registration deadline has passed' }, 400);
    }

    // Create registration object
    const registration: Registration = {
      event_id: body.event_id,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.trim() || '',
      department: body.department?.trim() || '',
      year: body.year?.trim() || '',
      additional_info: body.additional_info?.trim() || ''
    };

    // Check for duplicate registration
    const existingRegistrations = await sheetsService.readRange('registrations');
    if (existingRegistrations.length > 1) {
      for (let i = 1; i < existingRegistrations.length; i++) {
        const row = existingRegistrations[i];
        if (row[1] === registration.event_id && row[3] === registration.email) {
          return c.json({ 
            error: 'You are already registered for this event',
            message: 'Check your email for the confirmation details'
          }, 409);
        }
      }
    }

    // Save registration to Google Sheets
    await sheetsService.addRegistration(registration);

    // Send confirmation email (non-blocking)
    emailService.sendRegistrationConfirmation(registration, event).catch(error => {
      console.error('Failed to send confirmation email:', error);
    });

    // Send admin notification (non-blocking)
    emailService.sendAdminNotification(registration, event).catch(error => {
      console.error('Failed to send admin notification:', error);
    });

    return c.json({
      success: true,
      message: 'Registration successful! Check your email for confirmation.',
      registration: {
        event_id: registration.event_id,
        name: registration.name,
        email: registration.email,
        event_title: event.title,
        event_date: event.date_iso,
        event_location: event.location
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ 
      error: 'Registration failed',
      message: 'Please try again later or contact support'
    }, 500);
  }
});

// GET /api/register/verify/:email/:event_id - Verify registration status
register.get('/verify/:email/:event_id', async (c) => {
  try {
    const email = c.req.param('email').toLowerCase();
    const eventId = c.req.param('event_id');

    // Validate email format
    if (!validateEmail(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    const sheetsService = new GoogleSheetsService(c.env);
    
    // Check if registration exists
    const registrations = await sheetsService.readRange('registrations');
    let registrationFound = false;
    let registrationData = null;

    for (let i = 1; i < registrations.length; i++) {
      const row = registrations[i];
      if (row[1] === eventId && row[3] === email) {
        registrationFound = true;
        registrationData = {
          id: row[0],
          event_id: row[1],
          name: row[2],
          email: row[3],
          phone: row[4],
          department: row[5],
          year: row[6],
          additional_info: row[7],
          registered_at: row[8]
        };
        break;
      }
    }

    if (!registrationFound) {
      return c.json({
        registered: false,
        message: 'No registration found for this email and event'
      });
    }

    // Get event details
    const events = await sheetsService.getEvents();
    const event = events.find(e => e.id === eventId);

    return c.json({
      registered: true,
      registration: registrationData,
      event: event
    });

  } catch (error) {
    console.error('Verification error:', error);
    return c.json({ 
      error: 'Failed to verify registration'
    }, 500);
  }
});

// POST /api/register/cancel - Cancel registration
register.post('/cancel', async (c) => {
  try {
    const body = await c.req.json();
    
    const validationErrors = [
      validateRequired(body.email, 'email'),
      validateRequired(body.event_id, 'event_id')
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      return c.json({ 
        error: 'Validation failed',
        details: validationErrors
      }, 400);
    }

    if (!validateEmail(body.email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Note: Actual cancellation would require implementing update/delete functionality
    // in GoogleSheetsService. For now, we'll return a message about contacting admin.
    return c.json({
      success: false,
      error: 'Cancellation feature not yet implemented',
      message: 'Please contact IFHE administration to cancel your registration',
      contact: {
        email: 'info@ifheindia.org',
        phone: '+91-40-xxxx-xxxx'
      }
    });

  } catch (error) {
    console.error('Cancellation error:', error);
    return c.json({ 
      error: 'Failed to process cancellation request'
    }, 500);
  }
});

// Admin routes - require authentication
register.use('/admin/*', async (c, next) => {
  const authService = new AuthService(c.env);
  return requireAdmin(authService)(c, next);
});

// GET /api/register/admin/all - Get all registrations (admin only)
register.get('/admin/all', async (c) => {
  try {
    const sheetsService = new GoogleSheetsService(c.env);
    const registrations = await sheetsService.readRange('registrations');
    
    if (registrations.length <= 1) {
      return c.json({
        success: true,
        registrations: [],
        count: 0
      });
    }

    const allRegistrations = [];
    
    for (let i = 1; i < registrations.length; i++) {
      const row = registrations[i];
      if (row.length === 0) continue;

      allRegistrations.push({
        id: row[0] || '',
        event_id: row[1] || '',
        name: row[2] || '',
        email: row[3] || '',
        phone: row[4] || '',
        department: row[5] || '',
        year: row[6] || '',
        additional_info: row[7] || '',
        registered_at: row[8] || ''
      });
    }

    // Sort by registration time, newest first
    allRegistrations.sort((a, b) => 
      new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime()
    );

    return c.json({
      success: true,
      registrations: allRegistrations,
      count: allRegistrations.length
    });

  } catch (error) {
    console.error('Get admin registrations error:', error);
    return c.json({ 
      error: 'Failed to fetch registrations'
    }, 500);
  }
});

// GET /api/register/admin/event/:event_id - Get registrations for specific event (admin only)
register.get('/admin/event/:event_id', async (c) => {
  try {
    const eventId = c.req.param('event_id');
    const sheetsService = new GoogleSheetsService(c.env);
    const registrations = await sheetsService.readRange('registrations');
    
    const eventRegistrations = [];
    
    for (let i = 1; i < registrations.length; i++) {
      const row = registrations[i];
      if (row[1] === eventId) {
        eventRegistrations.push({
          id: row[0] || '',
          event_id: row[1] || '',
          name: row[2] || '',
          email: row[3] || '',
          phone: row[4] || '',
          department: row[5] || '',
          year: row[6] || '',
          additional_info: row[7] || '',
          registered_at: row[8] || ''
        });
      }
    }

    // Get event details
    const events = await sheetsService.getEvents();
    const event = events.find(e => e.id === eventId);

    return c.json({
      success: true,
      event: event,
      registrations: eventRegistrations,
      count: eventRegistrations.length
    });

  } catch (error) {
    console.error('Get event registrations error:', error);
    return c.json({ 
      error: 'Failed to fetch event registrations'
    }, 500);
  }
});

// GET /api/register/stats - Get registration statistics
register.get('/stats', async (c) => {
  try {
    const sheetsService = new GoogleSheetsService(c.env);
    const registrations = await sheetsService.readRange('registrations');
    const events = await sheetsService.getEvents();
    
    if (registrations.length <= 1) {
      return c.json({
        total_registrations: 0,
        active_events: events.length,
        events_with_registrations: 0
      });
    }

    const eventRegistrationCounts = new Map();
    
    for (let i = 1; i < registrations.length; i++) {
      const row = registrations[i];
      const eventId = row[1];
      if (eventId) {
        eventRegistrationCounts.set(eventId, (eventRegistrationCounts.get(eventId) || 0) + 1);
      }
    }

    return c.json({
      total_registrations: registrations.length - 1,
      active_events: events.length,
      events_with_registrations: eventRegistrationCounts.size,
      top_events: Array.from(eventRegistrationCounts.entries())
        .map(([eventId, count]) => {
          const event = events.find(e => e.id === eventId);
          return {
            event_id: eventId,
            event_title: event?.title || 'Unknown Event',
            registration_count: count
          };
        })
        .sort((a, b) => b.registration_count - a.registration_count)
        .slice(0, 5)
    });

  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ 
      error: 'Failed to fetch statistics'
    }, 500);
  }
});

export { register };