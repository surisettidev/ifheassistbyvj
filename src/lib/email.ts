// Email service for IFHE Campus Assistant Portal
import type { CloudflareBindings, Registration, Event } from '../types';

export class EmailService {
  private env: CloudflareBindings;

  constructor(env: CloudflareBindings) {
    this.env = env;
  }

  // Send email using SMTP (compatible with Cloudflare Workers)
  async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    if (!this.env.SMTP_HOST || !this.env.SMTP_USER || !this.env.SMTP_PASS) {
      console.error('SMTP configuration missing');
      return false;
    }

    try {
      // Use a third-party email service API (like SendGrid, Mailgun, etc.)
      // For demonstration, using a generic SMTP-compatible service
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: this.env.SMTP_HOST,
          template_id: 'ifhe_template',
          user_id: this.env.SMTP_USER,
          accessToken: this.env.SMTP_PASS,
          template_params: {
            to_email: to,
            subject: subject,
            html_content: htmlContent,
            from_name: 'IFHE Campus Assistant',
            from_email: 'noreply@ifheindia.org'
          }
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  // Send registration confirmation email
  async sendRegistrationConfirmation(registration: Registration, event?: Event): Promise<boolean> {
    const subject = `Registration Confirmation - ${event?.title || 'IFHE Event'}`;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .highlight { color: #667eea; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 IFHE Hyderabad</h1>
            <h2>Registration Confirmed!</h2>
        </div>
        
        <div class="content">
            <p>Dear <span class="highlight">${registration.name}</span>,</p>
            
            <p>Thank you for registering for our event! Your registration has been successfully confirmed.</p>
            
            ${event ? `
            <div class="event-details">
                <h3>📅 Event Details</h3>
                <p><strong>Event:</strong> ${event.title}</p>
                <p><strong>Date & Time:</strong> ${new Date(event.date_iso).toLocaleString()}</p>
                <p><strong>Location:</strong> ${event.location}</p>
                <p><strong>Description:</strong> ${event.description}</p>
            </div>
            ` : ''}
            
            <div class="event-details">
                <h3>📝 Your Registration Details</h3>
                <p><strong>Name:</strong> ${registration.name}</p>
                <p><strong>Email:</strong> ${registration.email}</p>
                ${registration.phone ? `<p><strong>Phone:</strong> ${registration.phone}</p>` : ''}
                ${registration.department ? `<p><strong>Department:</strong> ${registration.department}</p>` : ''}
                ${registration.year ? `<p><strong>Year:</strong> ${registration.year}</p>` : ''}
                ${registration.additional_info ? `<p><strong>Additional Info:</strong> ${registration.additional_info}</p>` : ''}
            </div>
            
            <p>Please save this email for your records. If you have any questions or need to make changes, please contact us.</p>
            
            <div style="text-align: center;">
                <a href="https://ifheindia.org" class="button">Visit IFHE Website</a>
            </div>
            
            <p><strong>Important Notes:</strong></p>
            <ul>
                <li>Please arrive 15 minutes before the event starts</li>
                <li>Bring a valid ID for verification</li>
                <li>Check your email for any updates about the event</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>© 2024 Indian School of Business & Finance (IFHE), Hyderabad</p>
            <p>This is an automated message from IFHE Campus Assistant Portal</p>
            <p>If you have questions, contact us at info@ifheindia.org</p>
        </div>
    </div>
</body>
</html>`;

    return await this.sendEmail(registration.email, subject, htmlContent);
  }

  // Send admin notification for new registration
  async sendAdminNotification(registration: Registration, event?: Event): Promise<boolean> {
    const adminEmail = 'admin@ifheindia.org'; // Configure this in environment
    const subject = `New Registration: ${event?.title || 'IFHE Event'}`;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f44336; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .details { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🔔 New Event Registration</h2>
        </div>
        
        <div class="content">
            <p>A new registration has been received for: <strong>${event?.title || 'Unknown Event'}</strong></p>
            
            <div class="details">
                <h3>Registrant Details:</h3>
                <p><strong>Name:</strong> ${registration.name}</p>
                <p><strong>Email:</strong> ${registration.email}</p>
                ${registration.phone ? `<p><strong>Phone:</strong> ${registration.phone}</p>` : ''}
                ${registration.department ? `<p><strong>Department:</strong> ${registration.department}</p>` : ''}
                ${registration.year ? `<p><strong>Year:</strong> ${registration.year}</p>` : ''}
                ${registration.additional_info ? `<p><strong>Additional Info:</strong> ${registration.additional_info}</p>` : ''}
                <p><strong>Registration Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p>Please review the registration and take necessary actions.</p>
        </div>
    </div>
</body>
</html>`;

    return await this.sendEmail(adminEmail, subject, htmlContent);
  }

  // Send event reminder email
  async sendEventReminder(registration: Registration, event: Event): Promise<boolean> {
    const subject = `Reminder: ${event.title} - Tomorrow!`;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff7043 0%, #ff5722 100%); color: white; padding: 30px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .reminder-box { background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 10px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Event Reminder</h1>
            <h2>${event.title}</h2>
        </div>
        
        <div class="content">
            <p>Dear ${registration.name},</p>
            
            <div class="reminder-box">
                <h3>🚨 Don't Forget!</h3>
                <p>Your registered event is happening <strong>tomorrow</strong>!</p>
                <p><strong>Date & Time:</strong> ${new Date(event.date_iso).toLocaleString()}</p>
                <p><strong>Location:</strong> ${event.location}</p>
            </div>
            
            <p><strong>What to bring:</strong></p>
            <ul>
                <li>Valid student ID or registration confirmation</li>
                <li>Notebook and pen for taking notes</li>
                <li>Any materials mentioned in the event details</li>
            </ul>
            
            <p>We look forward to seeing you there!</p>
            
            <p>Best regards,<br>IFHE Hyderabad Team</p>
        </div>
    </div>
</body>
</html>`;

    return await this.sendEmail(registration.email, subject, htmlContent);
  }

  // Test email configuration
  async testEmailConfig(): Promise<boolean> {
    const testSubject = 'IFHE Campus Assistant - Email Test';
    const testContent = `
<!DOCTYPE html>
<html>
<head>
    <style>body { font-family: Arial, sans-serif; padding: 20px; }</style>
</head>
<body>
    <h2>✅ Email Configuration Test</h2>
    <p>This is a test email from IFHE Campus Assistant Portal.</p>
    <p>If you received this email, the email service is working correctly!</p>
    <p><em>Test sent at: ${new Date().toISOString()}</em></p>
</body>
</html>`;

    return await this.sendEmail(
      this.env.SMTP_USER || 'test@example.com',
      testSubject,
      testContent
    );
  }
}