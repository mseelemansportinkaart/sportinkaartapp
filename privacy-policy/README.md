# Sportinkaart Privacy Policy - Vercel Deployment

This directory contains the privacy policy page for the Sportinkaart mobile app, ready to deploy to Vercel.

## Quick Deployment Steps

### Option 1: Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Navigate to this directory**:
   ```bash
   cd privacy-policy
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel
   ```

   Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? Choose your account
   - Link to existing project? **N**
   - Project name? **sportinkaart-privacy** (or your choice)
   - In which directory is your code? **./** (press Enter)
   - Want to override settings? **N**

4. **Your privacy policy will be live!**
   - You'll get a URL like: `https://sportinkaart-privacy.vercel.app`
   - Or deploy to production: `vercel --prod`

### Option 2: Deploy via Vercel Dashboard (Easiest)

1. **Go to [vercel.com](https://vercel.com)** and sign up/login

2. **Click "Add New..." → Project**

3. **Import Git Repository** or **Upload files**:
   - If using Git: Connect your GitHub/GitLab/Bitbucket and select the repo
   - If uploading: Drag and drop this `privacy-policy` folder

4. **Configure Project**:
   - Project Name: `sportinkaart-privacy`
   - Framework Preset: **Other**
   - Root Directory: Leave as is (or select `privacy-policy` if you uploaded the whole repo)
   - Build Settings: Leave defaults

5. **Click "Deploy"**

6. **Done!** Your URL will be: `https://sportinkaart-privacy.vercel.app`

### Option 3: Deploy from Main Repository

If you want to deploy from your main Sportinkaart repository:

1. Push this `privacy-policy` folder to your GitHub repo

2. In Vercel Dashboard:
   - Import your repository
   - Set **Root Directory** to: `privacy-policy`
   - Deploy

## Custom Domain (Optional)

To use a custom domain like `privacy.sportinkaart.nl`:

1. Go to your Vercel project settings
2. Click **Domains**
3. Add your custom domain
4. Update your DNS records as instructed by Vercel

## What to Do After Deployment

1. **Copy your deployed URL** (e.g., `https://sportinkaart-privacy.vercel.app`)

2. **Add to App Store Connect**:
   - Go to App Store Connect → Your App → App Privacy
   - Paste your privacy policy URL

3. **Test the URL**: Make sure it loads correctly before submitting to Apple

## Files Included

- `index.html` - The privacy policy page with Sportinkaart branding
- `vercel.json` - Vercel configuration for security headers and clean URLs
- `README.md` - This file

## Updating the Privacy Policy

To update the privacy policy in the future:

1. Edit `index.html`
2. Update the "Last Updated" date
3. Redeploy:
   ```bash
   vercel --prod
   ```

That's it! Vercel will automatically update your live page.

## Support

If you encounter issues, check:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
