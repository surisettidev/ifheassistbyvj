// Type definitions for IFHE Campus Assistant Portal

export interface CloudflareBindings {
  // Environment variables will be available here
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  ADMIN_API_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  APP_BASE_URL?: string;
  GOOGLE_CSE_ID?: string;
  GOOGLE_CSE_API_KEY?: string;
}

export interface ChatRequest {
  question: string;
  user_email?: string;
  user_name?: string;
}

export interface ChatResponse {
  html: string;
  model_used?: string;
  timestamp?: string;
  source_links?: string[];
}

export interface AIModel {
  name: string;
  endpoint: string;
  headers: Record<string, string>;
  body: any;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date_iso: string;
  location: string;
  rsvp_form?: string;
  visible: boolean;
  created_at?: string;
}

export interface Notice {
  id: string;
  title: string;
  body_html: string;
  category: string;
  posted_at_iso: string;
  visible: boolean;
  created_at?: string;
}

export interface Registration {
  id?: string;
  event_id: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  year?: string;
  additional_info?: string;
  created_at_iso?: string;
}

export interface ChatLog {
  timestamp: string;
  user_email?: string;
  user_name?: string;
  question: string;
  model_used: string;
  status: 'success' | 'error';
  raw_response?: string;
  final_answer_html: string;
  source_links?: string;
  error?: string;
}

export interface GoogleSheetsRow {
  [key: string]: string | number | boolean | null;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface AdminUser {
  email: string;
  role: 'admin' | 'moderator';
}