# GuruPRO AI

Platform administrasi guru berbasis AI untuk membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor dalam satu platform.

## Tech Stack

- **Framework:** Next.js (App Router)
- **CMS:** Payload CMS 3.x (admin at `/cms`)
- **Database:** PostgreSQL (via `@payloadcms/db-postgres`)
- **ORM/Query:** Payload CMS REST & Local API
- **UI:** Tailwind CSS v4, `@tabler/icons-react`
- **Auth:** `next-auth` + custom `gurupro_session` cookie

## Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm (recommended) or npm

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gurupro_db

# Payload CMS
PAYLOAD_SECRET=your-super-secret-key

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Auth (next-auth)
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Installation

```bash
pnpm install
pnpm run init:payload
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Payload CMS Initialization

### Quick Start (Recommended)

```bash
# Initialize Payload CMS with default content
pnpm run init:payload
```

This script will:
1. Connect to Payload CMS
2. Create default Features (6 items)
3. Create default Why Points (4 items)
4. Create/Update Landing Page global
5. Create/Update Footer global
6. Create/Update Chatbot Config

### Manual Push (if needed)

```bash
# Push Payload schema to database
pnpm run push:payload

# Or directly
npx payload push
```

### Payload Admin Access

1. Make sure you have an admin user in the database
2. Open: http://localhost:3000/cms
3. Login with admin credentials

## Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start development server |
| `pnpm run build` | Build for production |
| `pnpm run start` | Start production server |
| `pnpm run lint` | Run ESLint |
| `pnpm run typecheck` | TypeScript type check |

## Project Structure

```
src/
├── app/
│   ├── (admin)/          # Admin panel routes
│   │   └── admin/
│   │       └── cms-landing/  # CMS Landing Page admin UI
│   ├── (auth)/           # Auth routes (login, register)
│   ├── (landing)/        # Public landing page
│   │   ├── page.tsx      # Landing page (ISR, 60s revalidate)
│   │   ├── layout.tsx    # Landing layout with ChatbotWidget
│   │   ├── preview/
│   │   │   └── page.tsx  # Preview mode (force-dynamic)
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   ├── api/
│   │   ├── admin/
│   │   │   └── landing/  # CMS admin API routes
│   │   └── [...slug]/    # Payload catch-all API
│   └── globals.css
├── collections/          # Payload CMS schemas
├── components/
│   └── landing/          # Landing page section components
├── lib/
│   ├── payload.ts        # Payload client cache + data helpers
│   └── fallback-data.ts  # Default data + icon mapping
├── middleware.ts          # Route protection for /admin
├── payload.config.ts     # Payload CMS configuration
└── payload-types.ts      # Auto-generated Payload types
```

## CMS Admin

- **Payload Admin:** `/cms` — manage collections, globals, media
- **Custom Landing Page CMS:** `/admin/cms-landing` — edit landing page content (Hero, Features, Why Points, Footer, Chatbot)

### CMS Collections & Globals

| Slug | Type | Description |
|------|------|-------------|
| `landing-page` | Global | Hero section, SEO |
| `cms-features` | Collection | Featured items (icon, title, desc, order) |
| `why-points` | Collection | Why section bullet points |
| `footer-content` | Global | Footer description, links, social, contacts |
| `chatbot-config` | Global | Chatbot toggle, welcome message, system prompt |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/landing/hero` | GET, PUT | Get/update landing page global |
| `/api/admin/landing/features` | GET, POST, PUT, DELETE | CRUD features |
| `/api/admin/landing/chatbot` | GET, PUT | Get/update chatbot config |
| `/api/admin/landing/why` | GET, POST, PUT, DELETE | CRUD why points |
| `/api/admin/landing/footer` | GET, PUT | Get/update footer content |

## Landing Page Data Flow

1. `app/(landing)/page.tsx` is a **Server Component with ISR** (revalidates every 60s)
2. On request, it fetches data from Payload via `lib/payload.ts` helpers
3. Data is transformed and passed to section components in `components/landing/`
4. If Payload fetch fails, `lib/fallback-data.ts` provides default content
5. `middleware.ts` protects `/admin/*` routes, redirecting to `/login` if unauth

## Customization

- Edit landing section components in `components/landing/`
- Modify Payload CMS schemas in `collections/`
- Update default/fallback content in `lib/fallback-data.ts`
- Configure Tailwind theme in `app/globals.css`
