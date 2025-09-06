# Railway Setup Guide for Reading App Migration

## 🚀 Quick Deploy (Recommended - 3 Steps)

### Option A: GitHub Integration Deploy
1. **Go to Railway** → [railway.app](https://railway.app) and sign in
2. **Deploy from GitHub**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select `reading-app-v2` repository
   - Railway auto-detects Vite/React configuration
3. **Add PostgreSQL Database**:
   - Press `Ctrl/Cmd + K` (or click "New")
   - Select "PostgreSQL" template
   - Database deploys with SSL enabled automatically

**✅ That's it!** Railway automatically:
- Builds and deploys your Vite app
- Creates PostgreSQL database with SSL
- Generates `DATABASE_URL` environment variable
- Connects your app to the database
- Sets up auto-deployment on GitHub pushes

### Option B: One-Click Template Deploy
1. **Use Railway Template**: Visit [Railway Vite + React Template](https://railway.com/deploy/NeiLty)
2. **Connect Repository**: Link your `reading-app-v2` GitHub repo
3. **Add PostgreSQL**: Click "New" → "PostgreSQL" in your project dashboard

## 🔧 Configuration

### Environment Variables (Auto-Generated)
Railway automatically creates these for you:
- `DATABASE_URL` - Complete PostgreSQL connection string
- `PORT` - Application port (Railway manages this)

### App Configuration
Ensure your app can connect using Railway's `DATABASE_URL`:

```javascript
// Use Railway's DATABASE_URL (automatically available)
const connectionString = process.env.DATABASE_URL;
```

### Make App Publicly Accessible
After deployment:
1. Go to your service settings
2. Navigate to "Networking" section
3. Click "Generate Domain" for public URL

## ✅ Verification & Testing

### Check Deployment Status
1. **View Logs**: Click on your service → "Deployments" tab → View build/deploy logs
2. **Test Database**: Railway provides a built-in database console in the PostgreSQL service
3. **Verify App**: Your generated domain should show your React app running

### Local Development Setup
For local development with Railway database:

```env
# .env.local (for development only)
DATABASE_URL="your-railway-database-url-here"
VITE_WHISPER_SERVER_URL="http://nextcloud.bryceinasia.com:8000"
VITE_PREFERRED_SPEECH_SERVICE="whisper"
```

⚠️ **Important**: Never commit the actual `DATABASE_URL` to version control. Use Railway's environment variable management for production.

### Migration from Supabase
If migrating from existing database:
1. Export your existing schema and data
2. Use Railway's PostgreSQL console or CLI to import
3. Update your app's database connection to use `process.env.DATABASE_URL`

## 🔄 Continuous Deployment

**Auto-deployment is now active!** 
- Push to your GitHub repository
- Railway automatically rebuilds and deploys
- Zero downtime deployments
- Rollback available from Railway dashboard

## 💡 Pro Tips

- **Internal networking**: Your app automatically uses Railway's internal network (no egress fees)
- **SSL enabled**: PostgreSQL comes with SSL certificates pre-configured
- **Scaling**: Railway handles auto-scaling based on demand
- **Monitoring**: Built-in metrics and logging in Railway dashboard