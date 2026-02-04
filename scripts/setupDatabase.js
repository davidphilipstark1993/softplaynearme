// Setup database tables and seed Hull sample data
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function setupDatabase() {
  const client = await pool.connect()
  try {
    console.log('Creating database tables...\n')

    // Create venues table
    await client.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        city_slug VARCHAR(100) NOT NULL,
        address TEXT,
        postcode VARCHAR(10),
        lat DECIMAL(10, 8),
        lng DECIMAL(11, 8),
        phone VARCHAR(20),
        website VARCHAR(255),
        booking_url VARCHAR(255),
        description TEXT,
        opening_hours JSONB,
        price_range VARCHAR(100),
        cafe BOOLEAN DEFAULT false,
        parking BOOLEAN DEFAULT false,
        parties BOOLEAN DEFAULT false,
        toddler_area BOOLEAN DEFAULT false,
        baby_area BOOLEAN DEFAULT false,
        sen_friendly BOOLEAN DEFAULT false,
        wheelchair_access BOOLEAN DEFAULT false,
        free_wifi BOOLEAN DEFAULT false,
        age_ranges TEXT[],
        images TEXT[],
        last_verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        facilities JSONB DEFAULT '{}',
        price_from DECIMAL(6,2),
        price_to DECIMAL(6,2),
        google_place_id VARCHAR(255),
        featured BOOLEAN DEFAULT false,
        UNIQUE(city_slug, slug)
      );
    `)
    console.log('Venues table created!')

    // Create reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
        reviewer_name VARCHAR(100) NOT NULL,
        reviewer_email VARCHAR(255),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT NOT NULL,
        approved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('Reviews table created!')

    // Create venue_pricing table
    await client.query(`
      CREATE TABLE IF NOT EXISTS venue_pricing (
        id SERIAL PRIMARY KEY,
        venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
        price_type VARCHAR(50),
        age_group VARCHAR(50),
        price DECIMAL(6,2),
        duration_minutes INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('Venue pricing table created!')

    // Create venue_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS venue_sessions (
        id SERIAL PRIMARY KEY,
        venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
        session_type VARCHAR(50),
        day_of_week INTEGER,
        start_time TIME,
        end_time TIME,
        description TEXT,
        booking_required BOOLEAN DEFAULT false
      );
    `)
    console.log('Venue sessions table created!')

    // Create venue_photos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS venue_photos (
        id SERIAL PRIMARY KEY,
        venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
        url VARCHAR(500),
        alt_text VARCHAR(255),
        is_primary BOOLEAN DEFAULT false,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('Venue photos table created!')

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_city_slug ON venues(city_slug);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_slug ON venues(slug);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_venue_id ON reviews(venue_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venue_pricing_venue_id ON venue_pricing(venue_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venue_sessions_venue_id ON venue_sessions(venue_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venue_photos_venue_id ON venue_photos(venue_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_lat_lng ON venues(lat, lng);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_featured ON venues(featured);`)
    console.log('Indexes created!')

    console.log('\nDatabase setup complete!')

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Tables already exist.')
    } else {
      console.error('Error:', error.message)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

setupDatabase()
