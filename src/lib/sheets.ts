// Google Sheets integration for IFHE Campus Assistant Portal
import type { CloudflareBindings, GoogleSheetsRow, Event, Notice, Registration, ChatLog } from '../types';

export class GoogleSheetsService {
  private env: CloudflareBindings;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(env: CloudflareBindings) {
    this.env = env;
  }

  // Get Google API access token using service account
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !this.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      throw new Error('Google service account credentials not configured');
    }

    try {
      // Create JWT for service account authentication
      const now = Math.floor(Date.now() / 1000);
      const jwt = await this.createJWT(this.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, now);

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Auth error: ${data.error_description || data.error}`);
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Subtract 1 minute for buffer

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw new Error('Authentication failed');
    }
  }

  // Create JWT for Google API authentication
  private async createJWT(email: string, now: number): Promise<string> {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const payload = {
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, // 1 hour
      iat: now,
    };

    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(JSON.stringify(header));
    const payloadBytes = encoder.encode(JSON.stringify(payload));

    // Base64url encode
    const headerB64 = this.base64urlEncode(headerBytes);
    const payloadB64 = this.base64urlEncode(payloadBytes);
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Sign with private key
    const privateKey = this.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n');
    const signature = await this.sign(unsignedToken, privateKey);
    
    return `${unsignedToken}.${signature}`;
  }

  private base64urlEncode(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private async sign(data: string, privateKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);

    // Import the private key
    const keyData = await crypto.subtle.importKey(
      'pkcs8',
      this.pemToBinary(privateKey),
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    // Sign the data
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyData, dataBytes);
    return this.base64urlEncode(new Uint8Array(signature));
  }

  private pemToBinary(pem: string): ArrayBuffer {
    const base64 = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\\n/g, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '');
    
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Append row to specific sheet
  async appendRow(sheetName: string, values: (string | number | boolean)[]): Promise<void> {
    if (!this.env.GOOGLE_SHEET_ID) {
      throw new Error('Google Sheet ID not configured');
    }

    const accessToken = await this.getAccessToken();
    const range = `${sheetName}!A:Z`;

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.env.GOOGLE_SHEET_ID}/values/${range}:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [values],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to append row: ${error.error?.message || 'Unknown error'}`);
    }
  }

  // Read range from sheet
  async readRange(sheetName: string, range?: string): Promise<string[][]> {
    if (!this.env.GOOGLE_SHEET_ID) {
      throw new Error('Google Sheet ID not configured');
    }

    const accessToken = await this.getAccessToken();
    const fullRange = range ? `${sheetName}!${range}` : `${sheetName}!A:Z`;

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.env.GOOGLE_SHEET_ID}/values/${fullRange}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to read range: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.values || [];
  }

  // Update specific range
  async updateRange(sheetName: string, range: string, values: (string | number | boolean)[][]): Promise<void> {
    if (!this.env.GOOGLE_SHEET_ID) {
      throw new Error('Google Sheet ID not configured');
    }

    const accessToken = await this.getAccessToken();
    const fullRange = `${sheetName}!${range}`;

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.env.GOOGLE_SHEET_ID}/values/${fullRange}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update range: ${error.error?.message || 'Unknown error'}`);
    }
  }

  // Log chat interaction
  async logChat(log: ChatLog): Promise<void> {
    await this.appendRow('chat_logs', [
      log.timestamp,
      log.user_email || '',
      log.user_name || '',
      log.question,
      log.model_used,
      log.status,
      log.raw_response || '',
      log.final_answer_html,
      log.source_links || '',
      log.error || ''
    ]);
  }

  // Get events
  async getEvents(): Promise<Event[]> {
    try {
      const rows = await this.readRange('events');
      if (rows.length <= 1) return []; // No data or only headers

      const headers = rows[0];
      const events: Event[] = [];

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

        // Only include visible events with future dates
        if (event.visible && new Date(event.date_iso) >= new Date()) {
          events.push(event);
        }
      }

      return events.sort((a, b) => new Date(a.date_iso).getTime() - new Date(b.date_iso).getTime());
    } catch (error) {
      console.error('Failed to get events:', error);
      return [];
    }
  }

  // Get notices
  async getNotices(): Promise<Notice[]> {
    try {
      const rows = await this.readRange('notices');
      if (rows.length <= 1) return []; // No data or only headers

      const notices: Notice[] = [];

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

        if (notice.visible) {
          notices.push(notice);
        }
      }

      return notices.sort((a, b) => new Date(b.posted_at_iso).getTime() - new Date(a.posted_at_iso).getTime());
    } catch (error) {
      console.error('Failed to get notices:', error);
      return [];
    }
  }

  // Add registration
  async addRegistration(registration: Registration): Promise<void> {
    const id = registration.id || `reg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();

    await this.appendRow('registrations', [
      id,
      registration.event_id,
      registration.name,
      registration.email,
      registration.phone || '',
      registration.department || '',
      registration.year || '',
      registration.additional_info || '',
      timestamp
    ]);
  }

  // Get chat logs (for admin)
  async getChatLogs(limit: number = 50): Promise<ChatLog[]> {
    try {
      const rows = await this.readRange('chat_logs');
      if (rows.length <= 1) return [];

      const logs: ChatLog[] = [];
      const startIndex = Math.max(1, rows.length - limit);

      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0) continue;

        logs.push({
          timestamp: row[0] || '',
          user_email: row[1] || '',
          user_name: row[2] || '',
          question: row[3] || '',
          model_used: row[4] || '',
          status: (row[5] as 'success' | 'error') || 'error',
          raw_response: row[6] || '',
          final_answer_html: row[7] || '',
          source_links: row[8] || '',
          error: row[9] || ''
        });
      }

      return logs.reverse(); // Most recent first
    } catch (error) {
      console.error('Failed to get chat logs:', error);
      return [];
    }
  }

  // Create event (admin)
  async createEvent(event: Omit<Event, 'id' | 'created_at'>): Promise<void> {
    const id = `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();

    await this.appendRow('events', [
      id,
      event.title,
      event.description,
      event.date_iso,
      event.location,
      event.rsvp_form || '',
      event.visible ? 'TRUE' : 'FALSE',
      timestamp
    ]);
  }

  // Create notice (admin)
  async createNotice(notice: Omit<Notice, 'id' | 'created_at'>): Promise<void> {
    const id = `notice_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();

    await this.appendRow('notices', [
      id,
      notice.title,
      notice.body_html,
      notice.category,
      notice.posted_at_iso,
      notice.visible ? 'TRUE' : 'FALSE',
      timestamp
    ]);
  }
}