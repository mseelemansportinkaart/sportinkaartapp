# Email Debugging Guide

## Steps to Debug Email Sending

### 1. Check Your Terminal/Console

After submitting the form, look for these log messages in your terminal:

**Client-side logs (from the form):**
```
📧 Attempting to send email...
🌐 Sending request to: http://localhost:8081/api/send-suggestion
📦 Request body: {...}
📡 Response status: 200
📨 Response data: {...}
✅ Email sent successfully
```

**Server-side logs (from API route):**
```
🚀 API Route hit: /api/send-suggestion
🔑 API Key present: true
📦 Request body: {...}
📧 Attempting to send email via Resend...
✅ Email sent successfully!
```

### 2. Common Issues & Solutions

#### Issue 1: API Route Not Being Hit
**Symptoms:** You see client logs but NO "🚀 API Route hit" message

**Cause:** Expo API routes may not be supported in your current setup

**Solution:** We may need to use a different approach (see Alternative Solutions below)

#### Issue 2: Network Error
**Symptoms:** `⚠️  Network error - API route may not be accessible`

**Cause:** The fetch request can't reach the API endpoint

**Solutions:**
- Restart Expo server: `npm start`
- Make sure you're running on the same network
- Try using the Expo dev server URL instead

#### Issue 3: API Key Missing
**Symptoms:** `🔑 API Key present: false`

**Cause:** Environment variable not loaded

**Solutions:**
1. Check `.env` file exists and contains: `RESEND_API_KEY=re_your_api_key_here`
2. Restart Expo server completely
3. Clear cache: `npx expo start -c`

#### Issue 4: Resend API Error
**Symptoms:** You see logs up to "Attempting to send email via Resend" but then an error

**Possible causes:**
- Invalid API key
- Email address not verified in Resend
- Rate limit exceeded
- Resend service issue

### 3. Test the API Route Directly

You can test the API route directly using curl:

```bash
curl -X POST http://localhost:8081/api/send-suggestion \
  -H "Content-Type: application/json" \
  -d '{
    "type": "add",
    "formData": {
      "locationName": "Test Location",
      "sport": "Tennis",
      "address": "Test Address 123",
      "customerName": "Test User",
      "customerEmail": "test@example.com"
    }
  }'
```

Expected response:
```json
{"success": true, "data": {...}}
```

### 4. Check Resend Dashboard

1. Go to https://resend.com/emails
2. Check if the email appears in your logs (even if it failed)
3. Look for any error messages

## Alternative Solutions

### Option A: If API Routes Don't Work

Expo API routes may require specific configuration. If they're not working, we can:

1. **Use a separate backend service** (Vercel, Netlify, Railway)
2. **Use Expo's built-in mail composer** (requires manual send)
3. **Call Resend API directly from client** (NOT recommended - exposes API key)

### Option B: Quick Fix - Direct Resend Call (Temporary Testing Only)

For testing purposes only, you can call Resend directly from the client:

**⚠️ WARNING: This exposes your API key in the client code. Only use for testing!**

Let me know what you see in the logs and I can help further!

## Next Steps

1. Start your Expo server: `npm start`
2. Open the app and submit a test form
3. Check the terminal for all the log messages above
4. Tell me:
   - Which logs you see
   - Where the logs stop
   - Any error messages
