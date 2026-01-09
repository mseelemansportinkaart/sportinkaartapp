# Resend Email Setup Guide

This guide will help you set up automatic email sending for the Sportinkaart suggestion form using Resend.

## Prerequisites

- A Resend account (free tier includes 3,000 emails/month)
- Domain verification (or use Resend's sandbox for testing)

## Step 1: Get Your Resend API Key

1. Go to [https://resend.com/](https://resend.com/) and sign up or log in
2. Navigate to **API Keys** in the dashboard
3. Click **Create API Key**
4. Give it a name (e.g., "Sportinkaart Production")
5. Select the permissions you need (typically "Sending access")
6. Copy the API key (it starts with `re_`)

## Step 2: Configure Your Domain (Important!)

### For Production (Recommended):

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain: `sportinkaart.nl`
4. Follow the instructions to add DNS records (TXT, MX, CNAME)
5. Wait for verification (usually takes a few minutes)
6. Once verified, you can send from `noreply@sportinkaart.nl`

### For Testing (Quick Start):

- You can use Resend's sandbox domain for testing
- Change the `from` address in the API route from `noreply@sportinkaart.nl` to `onboarding@resend.dev`
- Note: Sandbox emails only go to the email address you signed up with

## Step 3: Set Up Environment Variables

1. Create a `.env` file in the project root:

```bash
cp .env.example .env
```

2. Open `.env` and add your Resend API key:

```env
EXPO_PUBLIC_RESEND_API_KEY=re_your_actual_api_key_here
```

⚠️ **Important**: Never commit the `.env` file to Git. It's already in `.gitignore`.

## Step 4: Update the API Route (If Using Sandbox)

If you're using the sandbox domain for testing, update the `from` email:

**File**: `app/api/send-suggestion+api.ts`

Change line ~120:
```typescript
// From:
from: 'Sportinkaart <noreply@sportinkaart.nl>',

// To (for testing):
from: 'onboarding@resend.dev',
```

Don't forget to change it back when you verify your domain!

## Step 5: Test the Setup

1. Start your Expo development server:
```bash
npm start
```

2. Open the app on your device or simulator

3. Click "Suggestie of vraag?"

4. Select "Nieuwe locatie toevoegen" or "Informatie wijzigen"

5. Fill out the form and submit

6. Check:
   - The app should show "Gelukt" (Success) message
   - Check your email inbox (the one you signed up with Resend for sandbox, or info@sportinkaart.nl for production)
   - The email should arrive within seconds

## Troubleshooting

### Email Not Sending

1. **Check API Key**: Make sure the API key in `.env` is correct
2. **Check Logs**: Look at the terminal/console for error messages
3. **Domain Verification**: If using your own domain, make sure it's verified
4. **Restart Expo**: After changing `.env`, restart the development server

### Common Errors

**"Failed to send email"**
- Check that the API key is set correctly in `.env`
- Restart the Expo server after adding the key

**"Invalid from address"**
- Make sure your domain is verified in Resend
- Or use `onboarding@resend.dev` for testing

**"Network request failed"**
- Make sure you're running the Expo server
- Check that the API route is accessible

## Production Deployment

When deploying to production:

1. ✅ Verify your domain in Resend
2. ✅ Update the `from` email to `noreply@sportinkaart.nl`
3. ✅ Set the `EXPO_PUBLIC_RESEND_API_KEY` in your hosting environment
4. ✅ Consider rate limiting to prevent abuse
5. ✅ Monitor your email quota in the Resend dashboard

## Email Quota

- **Free Tier**: 3,000 emails/month, 100 emails/day
- **Pro Tier**: $20/month for 50,000 emails
- Monitor usage at: [https://resend.com/home](https://resend.com/home)

## Support

- Resend Documentation: [https://resend.com/docs](https://resend.com/docs)
- Resend API Reference: [https://resend.com/docs/api-reference/introduction](https://resend.com/docs/api-reference/introduction)

---

## Quick Reference: Files Modified

- `app/api/send-suggestion+api.ts` - Email sending API route
- `lib/emailService.ts` - Client-side email service
- `components/SuggestionForm.tsx` - Updated to use API
- `.env` - Contains your API key (DO NOT COMMIT!)
- `.env.example` - Template for environment variables

## Next Steps

Once you have everything working:

1. Customize the email templates in `app/api/send-suggestion+api.ts`
2. Consider adding a confirmation email to users
3. Set up email notifications for your team
4. Add analytics to track form submissions
