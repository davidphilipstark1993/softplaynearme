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

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_city_slug ON venues(city_slug);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_slug ON venues(slug);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_venue_id ON reviews(venue_id);`)
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
