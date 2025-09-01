// Authentication service for IFHE Campus Assistant Portal
import { Context } from 'hono';
import type { CloudflareBindings } from '../types';

export class AuthService {
  private env: CloudflareBindings;

  constructor(env: CloudflareBindings) {
    this.env = env;
  }

  // Validate admin API key
  validateAdminKey(providedKey: string): boolean {
    if (!this.env.ADMIN_API_KEY) {
      console.error('ADMIN_API_KEY not configured');
      return false;
    }

    return providedKey === this.env.ADMIN_API_KEY;
  }

  // Extract token from Authorization header
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    // Support both "Bearer token" and "token" formats
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return authHeader;
  }

  // Create admin session token (simple JWT-like)
  async createSessionToken(email: string): Promise<string> {
    const payload = {
      email,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    };

    // Simple base64 encoding for demo (in production, use proper JWT with signing)
    return btoa(JSON.stringify(payload));
  }

  // Validate session token
  validateSessionToken(token: string): { email: string; role: string } | null {
    try {
      const decoded = JSON.parse(atob(token));
      
      // Check expiration
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return {
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      return null;
    }
  }

  // Rate limiting (simple in-memory store for demo)
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
    const now = Date.now();
    const key = identifier;
    
    let record = this.rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      this.rateLimitStore.set(key, record);
    }
    
    record.count++;
    
    return record.count <= maxRequests;
  }

  // Get client IP address
  getClientIP(c: Context): string {
    // Try various headers that might contain the real IP
    const headers = [
      'cf-connecting-ip', // Cloudflare
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
    ];

    for (const header of headers) {
      const ip = c.req.header(header);
      if (ip) {
        // If x-forwarded-for contains multiple IPs, take the first one
        return ip.split(',')[0].trim();
      }
    }

    // Fallback to a default
    return 'unknown';
  }
}

// Middleware for admin authentication
export function requireAdmin(authService: AuthService) {
  return async (c: Context, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Check if it's an API key or session token
    if (authService.validateAdminKey(token)) {
      // Valid API key
      await next();
      return;
    }

    // Try as session token
    const session = authService.validateSessionToken(token);
    if (session && session.role === 'admin') {
      // Valid session token
      c.set('user', session);
      await next();
      return;
    }

    return c.json({ error: 'Invalid authentication credentials' }, 401);
  };
}

// Middleware for rate limiting
export function rateLimit(authService: AuthService, maxRequests = 10, windowMs = 60000) {
  return async (c: Context, next: () => Promise<void>) => {
    const clientIP = authService.getClientIP(c);
    
    if (!authService.checkRateLimit(clientIP, maxRequests, windowMs)) {
      return c.json({ 
        error: 'Too many requests', 
        message: 'Please wait before making another request' 
      }, 429);
    }

    await next();
  };
}

// Middleware for CORS
export function corsMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    await next();

    // Add CORS headers to all responses
    c.res.headers.set('Access-Control-Allow-Origin', '*');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  };
}

// Input validation helpers
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateRequired(value: any, fieldName: string): string | null {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return null;
}

export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization (remove potentially dangerous tags)
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // Remove event handlers
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, ''); // Remove javascript: urls
}