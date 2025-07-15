# Railway Setup Guide for Reading App Migration

## Phase 1: Railway PostgreSQL Database Setup

### Step 1: Create Railway Project
1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Empty Project"
4. Name it: `reading-app-production`

### Step 2: Add PostgreSQL Database
1. In your Railway project dashboard, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically provision a PostgreSQL instance
4. Wait for deployment to complete

### Step 3: Get Database Connection Details
1. Click on the PostgreSQL service in your Railway dashboard
2. Go to the "Variables" tab
3. Copy the following environment variables:
   - `DATABASE_URL` (full connection string)
   - `PGHOST`
   - `PGPORT` 
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`

### Step 4: Test Database Connection
Use the Railway CLI or a PostgreSQL client to test the connection:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Connect to your project
railway link

# Open PostgreSQL shell
railway connect postgres
```

### Step 5: Database Configuration for App
Once you have the connection details, we'll need to:
1. Update environment variables in `.env`
2. Replace Supabase database client with PostgreSQL client
3. Migrate existing schema and data

### Next Steps
After completing the Railway setup:
- [ ] Update this guide with your specific connection details
- [ ] Proceed with schema migration from Supabase
- [ ] Set up database connection in the application

---

## Environment Variables Template

After completing Railway setup, update `.env` with:

```env
# Railway PostgreSQL Configuration
DATABASE_URL="postgresql://username:password@host:port/database"
PGHOST="your-host.railway.app"
PGPORT="5432"
PGDATABASE="railway"
PGUSER="postgres"
PGPASSWORD="your-password"

# Keep existing Whisper config
VITE_WHISPER_SERVER_URL="http://nextcloud.bryceinasia.com:8000"
VITE_PREFERRED_SPEECH_SERVICE="whisper"
```

## Security Notes
- Database credentials are automatically managed by Railway
- Use Railway's built-in environment variable management
- Never commit actual credentials to version control