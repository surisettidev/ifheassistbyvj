# IFHE Campus Assistant Portal - Setup Instructions

## Quick Setup Guide for Non-Coders

This document provides step-by-step instructions to deploy and configure the IFHE Campus Assistant Portal.

## Prerequisites

1. **GitHub Account** - For code hosting
2. **Cloudflare Account** - For hosting (free tier available)
3. **Google Account** - For Google Sheets database
4. **AI Service Accounts** - For chatbot functionality
5. **Email Service** - For notifications (optional)

## Step 1: Get API Keys

### 1.1 Google Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the API key (starts with `AIza...`)

### 1.2 Groq API Key  
1. Go to [Groq Console](https://console.groq.com/keys)
2. Sign up/login and create API key
3. Copy the API key (starts with `gsk_...`)

### 1.3 OpenRouter API Key
1. Go to [OpenRouter](https://openrouter.ai/keys)
2. Sign up/login and create API key
3. Copy the API key (starts with `sk-or-...`)

## Step 2: Set Up Google Sheets Database

### 2.1 Create Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Rename it to "IFHE Campus Assistant Data"
4. Copy the Sheet ID from URL (between `/d/` and `/edit`)

### 2.2 Create Required Sheets
Create these 4 sheets with exact names:

**Sheet 1: events**
Headers: `id | title | description | date_iso | location | rsvp_form | visible | created_at`

**Sheet 2: notices** 
Headers: `id | title | body_html | category | posted_at_iso | visible | created_at`

**Sheet 3: registrations**
Headers: `id | event_id | name | email | phone | department | year | additional_info | created_at_iso`

**Sheet 4: chat_logs**
Headers: `timestamp | user_email | user_name | question | model_used | status | raw_response | final_answer_html | source_links | error`

### 2.3 Set Up Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google Sheets API
4. Create Service Account:
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Name: "ifhe-assistant-bot"
   - Create and download JSON key file
5. Share your Google Sheet with the service account email (Editor access)

## Step 3: Deploy to Cloudflare Pages

### 3.1 Fork Repository
1. Fork this repository to your GitHub account
2. Clone to your local machine (optional)

### 3.2 Connect to Cloudflare Pages
1. Go to [Cloudflare Pages](https://pages.cloudflare.com)
2. Click "Create a project"
3. Connect to Git and select your forked repository
4. Build settings:
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Click "Save and Deploy"

### 3.3 Configure Environment Variables
In Cloudflare Pages dashboard > Settings > Environment Variables:

```bash
# AI API Keys
GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...

# Google Sheets
GOOGLE_SHEET_ID=1abc...xyz
GOOGLE_SERVICE_ACCOUNT_EMAIL=ifhe-assistant-bot@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Admin Access
ADMIN_API_KEY=your_secure_password_here

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# App URL
APP_BASE_URL=https://your-project.pages.dev
```

**Important:** For `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, copy the entire private key from the JSON file and escape newlines with `\n`.

## Step 4: Test Your Deployment

### 4.1 Basic Functionality Test
1. Visit your Cloudflare Pages URL
2. Test the chat interface with questions like:
   - "Tell me about IFHE Hyderabad"
   - "What programs does IFHE offer?"
3. Check if responses are generated

### 4.2 Admin Panel Test
1. Go to the Admin section
2. Login with your `ADMIN_API_KEY`
3. Verify you can see dashboard stats

### 4.3 Google Sheets Integration Test
1. Chat with the bot (questions get logged)
2. Check your Google Sheet's "chat_logs" tab
3. Verify new rows appear

## Step 5: Add Content

### 5.1 Add Sample Events
In Google Sheets "events" tab, add:
```
event_1 | Welcome Orientation | Join us for new student orientation | 2024-12-15T10:00:00Z | Main Auditorium | | TRUE | 2024-12-01T10:00:00Z
event_2 | Tech Workshop | Web Development Workshop | 2024-12-20T14:00:00Z | Computer Lab | | TRUE | 2024-12-01T10:00:00Z
```

### 5.2 Add Sample Notices
In Google Sheets "notices" tab, add:
```
notice_1 | Winter Break Schedule | <p>Classes will be suspended from Dec 25 to Jan 5.</p> | Academic | 2024-12-01T10:00:00Z | TRUE | 2024-12-01T10:00:00Z
notice_2 | Library Timings | <p>Library will be open 24/7 during exam period.</p> | General | 2024-12-01T10:00:00Z | TRUE | 2024-12-01T10:00:00Z
```

## Troubleshooting

### Common Issues

**1. Chat not responding**
- Check AI API keys are correct
- Verify all 3 API services are accessible
- Check Cloudflare Pages function logs

**2. Google Sheets errors**
- Verify service account email has access to sheet
- Check private key format (proper escaping)
- Ensure sheet names match exactly

**3. Admin panel not working**
- Verify ADMIN_API_KEY is set correctly
- Check browser console for errors

**4. Email not sending**
- Verify SMTP credentials
- For Gmail, use App Password instead of regular password
- Check spam folder for test emails

### Getting Help

1. Check Cloudflare Pages function logs
2. Test individual API endpoints:
   - `/api/health` - Basic health check
   - `/api/events` - Events list
   - `/api/notices` - Notices list

## Maintenance

### Regular Tasks
1. **Monitor chat logs** - Check for common questions and errors
2. **Update events** - Add new events to Google Sheets
3. **Post notices** - Keep students informed via notices
4. **Review analytics** - Use admin dashboard to track usage

### Security Best Practices
1. **Rotate API keys** regularly
2. **Use strong admin passwords**
3. **Monitor unauthorized access attempts**
4. **Keep environment variables secure**

## Cost Breakdown

### Free Tier Limits
- **Cloudflare Pages**: 500 builds/month, 20,000 requests/day
- **Google Sheets API**: 100 requests/100 seconds/user
- **Gemini API**: Limited free requests per day
- **Groq API**: Limited free requests per day

### Estimated Monthly Costs
- **Small campus (< 1000 students)**: $0-5/month
- **Medium campus (1000-5000 students)**: $5-20/month
- **Large campus (> 5000 students)**: $20-50/month

Most costs come from AI API usage above free tiers.

## Support

For technical support:
1. Check the troubleshooting section above
2. Review Cloudflare Pages documentation
3. Contact the development team with specific error messages

---

🎓 **IFHE Campus Assistant Portal v1.0**  
Built with ❤️ for IFHE Hyderabad students