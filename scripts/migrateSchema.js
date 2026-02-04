// Migration script to add new tables and columns for MVP enhancement
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function migrateSchema() {
  const client = await pool.connect()
  try {
    console.log('Starting schema migration...\n')

    // Add new columns to venues table
    console.log('Adding new columns to venues table...')

    const venueColumns = [
      { name: 'facilities', type: 'JSONB', default: "'{}'" },
      { name: 'price_from', type: 'DECIMAL(6,2)', default: null },
      { name: 'price_to', type: 'DECIMAL(6,2)', default: null },
      { name: 'google_place_id', type: 'VARCHAR(255)', default: null },
      { name: 'featured', type: 'BOOLEAN', default: 'false' }
    ]

    for (const col of venueColumns) {
      try {
        const defaultClause = col.default !== null ? `DEFAULT ${col.default}` : ''
        await client.query(`
          ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${defaultClause}
        `)
        console.log(`  ✓ Added column: ${col.name}`)
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  - Column ${col.name} already exists`)
        } else {
          throw error
        }
      }
    }

    // Create venue_pricing table
    console.log('\nCreating venue_pricing table...')
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
      )
    `)
    console.log('  ✓ venue_pricing table created')

    // Create venue_sessions table
    console.log('\nCreating venue_sessions table...')
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
      )
    `)
    console.log('  ✓ venue_sessions table created')

    // Create venue_photos table
    console.log('\nCreating venue_photos table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS venue_photos (
        id SERIAL PRIMARY KEY,
        venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
        url VARCHAR(500),
        alt_text VARCHAR(255),
        is_primary BOOLEAN DEFAULT false,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('  ✓ venue_photos table created')

    // Create indexes for new tables
    console.log('\nCreating indexes...')
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venue_pricing_venue_id ON venue_pricing(venue_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venue_sessions_venue_id ON venue_sessions(venue_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venue_photos_venue_id ON venue_photos(venue_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_lat_lng ON venues(lat, lng)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_featured ON venues(featured)`)
    console.log('  ✓ Indexes created')

    // Seed sample pricing data for existing venues
    console.log('\nSeeding sample pricing data...')
    const venues = await client.query('SELECT id, name FROM venues LIMIT 5')

    for (const venue of venues.rows) {
      // Check if pricing already exists
      const existingPricing = await client.query(
        'SELECT id FROM venue_pricing WHERE venue_id = $1 LIMIT 1',
        [venue.id]
      )

      if (existingPricing.rows.length === 0) {
        // Add sample pricing
        await client.query(`
          INSERT INTO venue_pricing (venue_id, price_type, age_group, price, duration_minutes, notes)
          VALUES
            ($1, 'standard', 'under_1', 0.00, 120, 'Free entry for under 1s'),
            ($1, 'standard', '1_to_3', 5.50, 120, 'Toddler rate'),
            ($1, 'standard', '4_to_8', 7.50, 120, 'Standard children rate'),
            ($1, 'standard', '9_plus', 8.50, 120, 'Older children rate'),
            ($1, 'standard', 'adult', 0.00, 120, 'Free adult entry'),
            ($1, 'weekend', '1_to_3', 6.50, 120, 'Weekend toddler rate'),
            ($1, 'weekend', '4_to_8', 8.50, 120, 'Weekend children rate')
        `, [venue.id])

        // Update price_from and price_to on venue
        await client.query(`
          UPDATE venues SET price_from = 5.50, price_to = 8.50 WHERE id = $1
        `, [venue.id])

        console.log(`  ✓ Added pricing for: ${venue.name}`)
      }
    }

    // Seed sample session data
    console.log('\nSeeding sample session data...')
    for (const venue of venues.rows) {
      const existingSessions = await client.query(
        'SELECT id FROM venue_sessions WHERE venue_id = $1 LIMIT 1',
        [venue.id]
      )

      if (existingSessions.rows.length === 0) {
        await client.query(`
          INSERT INTO venue_sessions (venue_id, session_type, day_of_week, start_time, end_time, description, booking_required)
          VALUES
            ($1, 'toddler', 1, '09:30', '11:30', 'Exclusive toddler session for under 4s', true),
            ($1, 'toddler', 3, '09:30', '11:30', 'Exclusive toddler session for under 4s', true),
            ($1, 'baby', 2, '10:00', '11:30', 'Baby sensory play for under 1s', true),
            ($1, 'sen', 4, '09:00', '10:30', 'Quieter session with reduced lighting and noise', true)
        `, [venue.id])

        console.log(`  ✓ Added sessions for: ${venue.name}`)
      }
    }

    // Update facilities JSONB for existing venues
    console.log('\nUpdating facilities data...')
    await client.query(`
      UPDATE venues SET facilities = jsonb_build_object(
        'cafe', cafe,
        'parking', parking,
        'parties', parties,
        'toddler_area', toddler_area,
        'baby_area', baby_area,
        'sen_friendly', sen_friendly,
        'wheelchair_access', wheelchair_access,
        'free_wifi', free_wifi,
        'baby_changing', true,
        'lockers', false,
        'outdoor_area', false,
        'air_conditioning', false,
        'socks_required', true
      )
      WHERE facilities = '{}'::jsonb OR facilities IS NULL
    `)
    console.log('  ✓ Facilities data updated')

    console.log('\n✅ Schema migration complete!')

  } catch (error) {
    console.error('Migration error:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrateSchema()
