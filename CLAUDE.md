# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Claude Workflow Rules
1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the [todo.md](http://todo.md/) file with a summary of the changes you made and any other relevant information.

## Reading Recording Application Overview

This is a React TypeScript application for elementary reading practice with audio recording and feedback. The app is currently undergoing a migration from Supabase to Railway PostgreSQL with BetterAuth.

### Core Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js with custom API handlers via Vite middleware  
- **Database**: PostgreSQL on Railway (migrated from Supabase)
- **Authentication**: BetterAuth with multi-role support
- **Deployment**: Railway with Vite preview server

### User Roles & Authentication

**Three distinct user types with different auth flows:**

1. **Students**: Visual password authentication (no email required)
   - Access via class access tokens
   - Practice reading assignments
   - Record audio for teacher review

2. **Teachers**: Email/password authentication
   - Manage classes and students
   - Create reading assignments  
   - Review student recordings

3. **Admins**: Email/password with elevated permissions
   - Create teacher accounts
   - System-wide management
   - Pre-created accounts (no self-registration)

## Development Commands

```bash
# Development
npm run dev              # Start dev server with API middleware (localhost:5173)
npm run build           # Build for production
npm run preview         # Railway-compatible preview server
npm run lint            # ESLint code checking

# Database Scripts
node scripts/generate-admin-account.js    # Create admin user in database
node scripts/run-migration.js            # Run database migrations

# Railway Deployment
git push origin main    # Auto-deploys to Railway via GitHub integration
```

## Key Files & Architecture

### Authentication System
- `src/lib/better-auth-server.ts` - BetterAuth server configuration (server-side only)
- `src/lib/auth-client.ts` - BetterAuth client with fallbacks
- `src/contexts/UnifiedAuthContext.tsx` - React auth provider
- `src/api/auth/index.ts` - Auth API handlers

### API Layer
- `src/api/index.ts` - Main API router and utilities
- `src/api/auth/` - Authentication endpoints
- `src/api/classes/` - Class management endpoints
- `src/api/visual-passwords/` - Student visual auth endpoints
- `vite.config.ts` - Custom middleware for API route handling

### Database Layer
- `src/lib/database.ts` - PostgreSQL connection pool
- `src/lib/database-service.ts` - Database operations (replaces Supabase client)
- `railway-migration/` - Database schema and setup scripts

### Component Structure
```
src/components/
├── auth/           # Authentication components
├── modals/         # Modal dialogs (class, student, teacher creation)
├── *Dashboard.tsx  # Role-specific dashboards
├── *Login.tsx      # Role-specific login forms
└── core reading practice components
```

### Types & Interfaces
- `src/types/index.ts` - Core application types (Story, FeedbackData, etc.)
- API response types defined inline in API handlers

## Railway Deployment Configuration

**Critical**: This app uses a custom Vite configuration for Railway compatibility.

### Vite Configuration (`vite.config.ts`)
```typescript
preview: {
  host: '0.0.0.0',
  port: process.env.PORT || 4173,
  allowedHosts: ['healthcheck.railway.app', 'localhost', '127.0.0.1']
}
```

### Custom API Middleware
- Handles `/api/*` routes in both development and preview modes
- Converts Node.js requests to Web API format for unified handling
- Essential for Railway deployment (runs `npm run preview`)

### Railway Files
- `railway.json` - Deployment configuration
- `package.json` - Node >=20 requirement for compatibility

## Environment Variables

### Required for Development
```env
DATABASE_URL=postgresql://user:pass@host:port/db    # Railway PostgreSQL
BETTER_AUTH_SECRET=your-secret-key                 # BetterAuth encryption
BETTER_AUTH_URL=http://localhost:5173              # BetterAuth base URL
```

### Railway Auto-Generated
- `DATABASE_URL` - PostgreSQL connection (auto-created)
- `PORT` - Application port (Railway manages)

## Database Schema

### Core Tables
- `user` - BetterAuth user records
- `account` - BetterAuth account records  
- `session` - BetterAuth session management
- `profiles` - Extended user profiles (role, class_id, etc.)
- `classes` - Teacher classes with access tokens
- `assignments` - Reading assignments
- `recording_submissions` - Student audio recordings
- `visual_passwords` - Student visual authentication

### Key Relationships
- Users have profiles (1:1)
- Students belong to classes via `class_id`
- Teachers own classes via `teacher_id`
- Recordings link students to assignments

## Migration Status (Supabase → Railway)

**Current State**: Mostly complete, authentication system stabilizing

✅ **Completed:**
- Database schema migrated to Railway PostgreSQL
- BetterAuth integration with custom handlers
- API layer unified under `/api/*` routes
- Vite middleware for Railway compatibility
- Multi-role authentication flows

🔄 **In Progress:**
- Final authentication system stabilization
- Railway deployment configuration fixes

❌ **Removed:**
- Whisper server analysis (replaced with basic audio duration)
- 57+ Supabase RLS migration files
- Supabase client dependencies

## Common Development Patterns

### Making API Calls
```typescript
// Use fetch with relative URLs - Vite middleware handles routing
const response = await fetch('/api/auth/sign-in', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

### Database Operations
```typescript
// Use DatabaseService instead of Supabase client
import { DatabaseService } from '../lib/database-service';

const user = await DatabaseService.getUserByEmail(email);
const classes = await DatabaseService.getClassesByTeacher(teacherId);
```

### Authentication Checks
```typescript
// Use UnifiedAuthContext
const { user, signIn, signOut, isLoading } = useAuth();

// Role-based access
if (user?.role === 'teacher') {
  // Teacher-specific functionality
}
```

## Development Notes

### API Route Debugging
- Routes are handled by Vite middleware in development
- Check browser network tab for API call routing
- Vite dev server logs show middleware activity

### Authentication System
- BetterAuth runs server-side only (`isBrowser` checks)
- Fallback handlers provide stability during development
- Visual password auth is custom implementation for students

### Railway Deployment
- Uses `vite preview` not static hosting
- Custom middleware must work in preview mode
- Health checks require specific host allowlist

### Database Connections
- Always use connection pool from `src/lib/database.ts`
- Railway provides SSL-enabled PostgreSQL automatically
- Connection string format: `postgresql://user:pass@host:port/db?sslmode=require`

## Testing Strategy

**Currently No Automated Tests** - Manual testing workflow:

1. **Authentication Testing**:
   - Test each role login (student visual, teacher email, admin email)
   - Verify role-based redirects work correctly
   - Check session persistence across page refreshes

2. **API Testing**:
   - Use browser DevTools Network tab
   - Test CRUD operations for classes, students, assignments
   - Verify error handling and response formats

3. **Database Testing**:
   - Use Railway PostgreSQL console for direct queries
   - Verify BetterAuth tables and custom schema work together
   - Test foreign key relationships

4. **Deployment Testing**:
   - Test Railway preview deployment
   - Verify environment variables are set correctly
   - Check logs for API middleware functionality

## Troubleshooting

### Common Issues

**Railway 502 Errors**:
- Check Node.js version (requires >=20)
- Verify `railway.json` uses `npm run preview`
- Ensure Vite preview configuration includes Railway hosts

**Authentication Failures**:
- Check BetterAuth environment variables
- Verify database connection and tables exist
- Look for `isBrowser` checks preventing server-side auth

**API Route 404/405 Errors**:
- Confirm Vite middleware is running (dev server logs)
- Check API route patterns in `src/api/index.ts`
- Verify method handling in route handlers

**Database Connection Issues**:
- Confirm `DATABASE_URL` format includes SSL mode
- Test connection using Railway PostgreSQL console
- Check for connection pool exhaustion

### Migration Cleanup

If encountering Supabase-related errors:
```bash
# Search for remaining Supabase references
grep -r "supabase" src/ --exclude-dir=node_modules
grep -r "createClient" src/ --exclude-dir=node_modules

# Remove any remaining Supabase imports
# Replace with DatabaseService calls
```

## File Location Reference

**Authentication**: `src/lib/better-auth-server.ts`, `src/api/auth/`
**Database**: `src/lib/database.ts`, `src/lib/database-service.ts`  
**API Routes**: `src/api/index.ts` and subdirectories
**Components**: `src/components/` organized by feature
**Types**: `src/types/index.ts` for core types
**Migration**: `railway-migration/` for database setup
**Scripts**: `scripts/` for database and admin account creation