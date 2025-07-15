# 🚀 Database Migration Instructions

## **IMPORTANT: Execute these scripts IN ORDER to fix the infinite recursion errors**

### **⚠️ Current Issues:**
- `infinite recursion detected in policy for relation "profiles"`
- 500 Internal Server Error on assignments and recordings
- Admin dashboard failing to load

### **💾 Backup First (Recommended):**
Before running any scripts, create a backup of your database in Supabase Dashboard > Settings > Database.

---

## **📋 Step-by-Step Migration Process:**

### **Step 1: Emergency Fix (CRITICAL - Run First)**
**File:** `database/009_emergency_fix_policies.sql`
**Purpose:** Stop infinite recursion immediately

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy & paste the **entire content** from `009_emergency_fix_policies.sql`
3. Click **"Run"**
4. **Verify:** Admin dashboard should load without 500 errors

### **Step 2: Complete Database Setup**
**File:** `database/010_complete_schema_setup.sql`
**Purpose:** Ensure all tables and fields exist

1. In **SQL Editor**, copy & paste content from `010_complete_schema_setup.sql`
2. Click **"Run"**
3. **Verify:** Check that all tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

### **Step 3: Safe RLS Policies**
**File:** `database/011_safe_rls_policies.sql`
**Purpose:** Implement secure, non-recursive policies

1. In **SQL Editor**, copy & paste content from `011_safe_rls_policies.sql`
2. Click **"Run"**
3. **Verify:** Check policies are safe:
   ```sql
   SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
   ORDER BY tablename;
   ```

---

## **🧪 Testing After Migration:**

### **Test 1: Admin Dashboard Loading**
1. Refresh browser at admin dashboard
2. **Expected:** Dashboard loads without 500 errors
3. **Expected:** Overview tab shows statistics

### **Test 2: Teacher Creation**
1. Go to **Teachers** tab
2. Click **"Add Teacher"**
3. Fill form and submit
4. **Expected:** Teacher created successfully (no infinite recursion error)

### **Test 3: Class Management**
1. Go to **Classes** tab
2. Click **"Add Class"** and create a test class
3. Click **"Manage Roster"** on a class
4. **Expected:** Roster management opens with drag-drop interface

### **Test 4: Student Management**
1. Go to **Students** tab
2. Try adding a student manually
3. Try bulk import with CSV
4. **Expected:** All operations work without errors

---

## **🔧 Troubleshooting:**

### **If you still get 500 errors after Step 1:**
```sql
-- Run this to completely disable RLS temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;
-- Then proceed with Step 2 and 3, then re-enable RLS
```

### **If functions don't exist:**
The scripts create all necessary functions. If you get "function does not exist" errors, re-run the scripts in order.

### **If you see permission errors:**
Make sure you're connected as the database owner in Supabase SQL Editor.

---

## **✅ Expected Final State:**

After successful migration:

- ✅ **No infinite recursion errors**
- ✅ **Admin dashboard loads completely**
- ✅ **All CRUD operations work** (create/edit teachers, classes, students)
- ✅ **Drag-drop roster management** functional
- ✅ **Bulk operations** and CSV import work
- ✅ **Secure RLS policies** without circular references

---

## **🆘 If Something Goes Wrong:**

1. **Check Supabase Logs:** Dashboard → Logs → Database
2. **Verify Script Execution:** Look for error messages during SQL execution
3. **Contact Support:** If issues persist, provide the specific error message

**The admin dashboard should be fully functional after these migrations!** 🎉