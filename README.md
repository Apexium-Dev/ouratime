# OurATime

A time tracking webapp built with Next.js (inspired by Clockify)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Supabase

Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Then update `.env.local` with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can get these from your Supabase project settings at [supabase.com](https://supabase.com).

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `app/` - Next.js App Router pages and layouts
- `lib/` - Utility functions and configurations (Supabase client, etc.)
- `public/` - Static assets

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
