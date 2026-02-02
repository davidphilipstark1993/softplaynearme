# Soft Play Near Me

A directory site for UK soft play centres, built with Next.js 16.

**Live site:** https://www.softplaynearme.co.uk

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- PostgreSQL (Neon)
- Vercel deployment

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (Neon recommended)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

### Database Setup

```bash
# Create tables
npm run db:setup

# Seed sample data (optional)
npm run db:seed
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Google Places API Scraper

The scraper fetches soft play venues from Google Places API v1 and imports them to the database.

### Setup

1. **Get a Google Places API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the "Places API (New)"
   - Create an API key with Places API access

2. **Set the environment variable:**
   ```bash
   export GOOGLE_PLACES_API_KEY=your_api_key_here
   ```

### Running the Scraper

**Scrape Hull venues:**
```bash
GOOGLE_PLACES_API_KEY=your_key npm run scrape:hull
```

**Output:** `hull-softplay-places.csv` in the project root

The scraper:
- Searches multiple queries: "soft play", "soft play centre", "indoor play centre", etc.
- Deduplicates results by place_id
- Outputs venue data including name, address, coordinates, rating, website, phone, opening hours

### Importing to Database

After scraping, import the CSV to your Neon database:

```bash
DATABASE_URL=your_database_url npm run import:hull
```

This will:
- Add any missing columns to the venues table
- Upsert venues by place_id (insert new, update existing)
- Generate URL slugs automatically

### CSV Output Format

The scraper outputs these columns:
- `place_id` - Google's unique place identifier
- `name` - Venue name
- `formatted_address` - Full address
- `postcode` - Extracted UK postcode
- `city` - City name (Hull)
- `lat`, `lng` - Coordinates
- `rating` - Google rating (1-5)
- `reviews_count` - Number of Google reviews
- `website` - Venue website URL
- `phone` - Phone number
- `google_maps_url` - Link to Google Maps
- `types` - Google place types (pipe-separated)
- `open_now` - Whether currently open
- `opening_hours_text` - Human-readable opening hours

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:setup` | Create database tables |
| `npm run db:seed` | Seed sample Hull venues |
| `npm run scrape:hull` | Scrape Hull soft play from Google Places |
| `npm run import:hull` | Import CSV to Neon database |

## Project Structure

```
softplaynearme/
├── app/
│   ├── soft-play/
│   │   ├── [city]/
│   │   │   ├── page.tsx        # City listing page
│   │   │   └── [slug]/
│   │   │       └── page.tsx    # Venue detail page
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── pool.ts                 # Database connection
│   └── venues.ts               # City/filter configs
├── scripts/
│   ├── setupDatabase.js        # DB schema setup
│   ├── seedHullVenues.js       # Sample data seeder
│   ├── scrape-hull-softplay.mjs    # Google Places scraper
│   └── import-softplay-to-neon.mjs # CSV importer
└── public/
```

## Deployment

The site is deployed on Vercel. Push to main branch to deploy.

Required Vercel environment variables:
- `DATABASE_URL` - Neon PostgreSQL connection string
