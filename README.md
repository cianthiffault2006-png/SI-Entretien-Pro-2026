# SI Entretien Pro

Système de gestion des ventes et opérations — remplacement de SalesRabbit + Jobber scheduling.

## Stack
- **Next.js 14** (App Router) on Vercel
- **Supabase** (Auth + DB + Realtime + Storage)
- **Leaflet + OpenStreetMap** (maps, free)
- **Resend** (transactional emails)
- **Jobber GraphQL API** (job sync)

---

## Deployment (new repo)

### 1. Create GitHub repo
Go to github.com → New repository → Name: `si-entretien-pro` → Create

### 2. Push code
```powershell
cd "C:\path\to\this\folder"
git init
git add .
git commit -m "SI Entretien Pro — initial build"
git branch -M main
git remote add origin https://github.com/cianthiffault2006-png/si-entretien-pro.git
git push -u origin main
```

### 3. Deploy to Vercel
1. Go to vercel.com → New Project → Import from GitHub → select `si-entretien-pro`
2. Framework: **Next.js** (auto-detected)
3. Add all environment variables (see below)
4. Deploy

### 4. Environment Variables (add in Vercel dashboard)
```
NEXT_PUBLIC_SUPABASE_URL=https://jzmmqtkhakdgiscigwdw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
RESEND_API_KEY=re_JPG5rMqk_...
JOBBER_API_KEY=495e77b3f4e7...
NEXT_PUBLIC_APP_URL=https://si-entretien-pro.vercel.app
CRON_SECRET=pick_any_random_string_here
```

### 5. Supabase: Enable Realtime on pings table
1. Supabase dashboard → Database → Replication
2. Enable replication on the `pings` table
3. This enables live map updates across all reps

### 6. Supabase: Create storage buckets
1. Supabase dashboard → Storage → New bucket
2. Name: `contracts` · Private · 10MB max
3. Name: `signatures` · Private · 2MB max

### 7. Jobber webhook setup
1. Jobber dashboard → Settings → API → Webhooks
2. Add webhook URL: `https://si-entretien-pro.vercel.app/api/webhooks/jobber`
3. Select events: `JOB_COMPLETED`
4. This auto-confirms closes and triggers commission tier checks

---

## Module overview

| Module | Path | Who |
|--------|------|-----|
| Dashboard | `/dashboard` | All roles |
| Map & Pings | `/map` | Reps, managers |
| New booking | `/book` | Reps, managers |
| Contract | `/contract` | Reps |
| Schedule | `/schedule` | All roles |
| Sales tracker | `/sales` | Reps, managers |
| Leaderboard | `/leaderboard` | All |
| Payroll | `/payroll` | Reps, managers |
| Team admin | `/admin/users` | Managers, admins |
| Settings | `/settings` | All |

---

## Default login
All users: their email + password `si123`
They can change their password in Settings.

---

## Commission tiers (resets yearly)
| Confirmed closes | Rate |
|-----------------|------|
| 0–149 | 15% |
| 150–299 | 17.5% |
| 300–449 | 20% |
| 450+ | 25% (Élite) |

Commission = prix_final (pre-tax) × rate
Status: **pending** when contract signed → **confirmed** when Jobber marks job complete
