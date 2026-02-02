// Seed Hull with sample soft play venues
// Run: node scripts/seedHullVenues.js
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const hullVenues = [
  {
    name: 'Adventure Land Play Centre',
    slug: 'adventure-land-play-centre',
    city_slug: 'hull',
    address: '123 Anlaby Road',
    postcode: 'HU3 2SE',
    lat: 53.7456,
    lng: -0.3567,
    phone: '01234 567890',
    website: 'https://example.com',
    description: 'Adventure Land is a large indoor play centre in Hull with a multi-level soft play frame, ball pits, slides, and a dedicated toddler area. We offer birthday party packages and have a cafe serving hot and cold food.',
    opening_hours: {
      monday: { open: '09:30', close: '18:00' },
      tuesday: { open: '09:30', close: '18:00' },
      wednesday: { open: '09:30', close: '18:00' },
      thursday: { open: '09:30', close: '18:00' },
      friday: { open: '09:30', close: '18:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: { open: '10:00', close: '17:00' }
    },
    price_range: 'From £5.50 per child',
    cafe: true,
    parking: true,
    parties: true,
    toddler_area: true,
    baby_area: true,
    sen_friendly: true,
    wheelchair_access: true,
    free_wifi: true,
    age_ranges: ['0-2', '2-5', '5-11']
  },
  {
    name: 'Jungle Jim\'s Play Zone',
    slug: 'jungle-jims-play-zone',
    city_slug: 'hull',
    address: '45 Holderness Road',
    postcode: 'HU8 8JS',
    lat: 53.7589,
    lng: -0.3234,
    phone: '01234 567891',
    description: 'A jungle-themed soft play centre with rope bridges, climbing walls, and exciting slides. Perfect for adventurous kids aged 2-10.',
    opening_hours: {
      monday: { open: '10:00', close: '17:30' },
      tuesday: { open: '10:00', close: '17:30' },
      wednesday: { open: '10:00', close: '17:30' },
      thursday: { open: '10:00', close: '17:30' },
      friday: { open: '10:00', close: '18:00' },
      saturday: { open: '09:30', close: '18:00' },
      sunday: { open: '10:00', close: '17:00' }
    },
    price_range: '£4.95 - £6.95 per child',
    cafe: true,
    parking: true,
    parties: true,
    toddler_area: true,
    baby_area: false,
    sen_friendly: false,
    wheelchair_access: true,
    free_wifi: true,
    age_ranges: ['2-5', '5-10']
  },
  {
    name: 'Little Explorers Soft Play',
    slug: 'little-explorers-soft-play',
    city_slug: 'hull',
    address: '78 Spring Bank',
    postcode: 'HU3 1AH',
    lat: 53.7523,
    lng: -0.3489,
    phone: '01234 567892',
    description: 'A cosy soft play designed especially for babies and toddlers under 5. Features sensory play areas, ball pools, and gentle slides in a calm environment.',
    opening_hours: {
      monday: { open: '09:00', close: '16:00' },
      tuesday: { open: '09:00', close: '16:00' },
      wednesday: { open: '09:00', close: '16:00' },
      thursday: { open: '09:00', close: '16:00' },
      friday: { open: '09:00', close: '16:00' },
      saturday: { open: '10:00', close: '16:00' },
      sunday: { open: 'closed', close: 'closed' }
    },
    price_range: '£4.00 per child',
    cafe: true,
    parking: false,
    parties: true,
    toddler_area: true,
    baby_area: true,
    sen_friendly: true,
    wheelchair_access: true,
    free_wifi: true,
    age_ranges: ['0-2', '2-4']
  },
  {
    name: 'Mega Fun Factory',
    slug: 'mega-fun-factory',
    city_slug: 'hull',
    address: '200 Hessle Road',
    postcode: 'HU4 6NF',
    lat: 53.7398,
    lng: -0.3678,
    phone: '01234 567893',
    description: 'Hull\'s largest indoor play centre with 3 levels of play equipment, go-karts, and a dedicated party zone. Great for all ages from toddlers to pre-teens.',
    opening_hours: {
      monday: { open: '09:30', close: '19:00' },
      tuesday: { open: '09:30', close: '19:00' },
      wednesday: { open: '09:30', close: '19:00' },
      thursday: { open: '09:30', close: '19:00' },
      friday: { open: '09:30', close: '20:00' },
      saturday: { open: '09:00', close: '20:00' },
      sunday: { open: '10:00', close: '18:00' }
    },
    price_range: '£5.50 - £8.50 per child',
    cafe: true,
    parking: true,
    parties: true,
    toddler_area: true,
    baby_area: true,
    sen_friendly: true,
    wheelchair_access: true,
    free_wifi: true,
    age_ranges: ['0-2', '2-5', '5-12']
  },
  {
    name: 'Playtown Hull',
    slug: 'playtown-hull',
    city_slug: 'hull',
    address: '15 Princes Quay',
    postcode: 'HU1 2PQ',
    lat: 53.7445,
    lng: -0.3345,
    description: 'Located in the city centre, Playtown Hull offers convenient soft play while shopping. Features include slides, tunnels, and a small cafe area.',
    opening_hours: {
      monday: { open: '10:00', close: '18:00' },
      tuesday: { open: '10:00', close: '18:00' },
      wednesday: { open: '10:00', close: '18:00' },
      thursday: { open: '10:00', close: '20:00' },
      friday: { open: '10:00', close: '20:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: { open: '11:00', close: '17:00' }
    },
    price_range: '£4.50 per child',
    cafe: true,
    parking: true,
    parties: false,
    toddler_area: true,
    baby_area: false,
    sen_friendly: false,
    wheelchair_access: true,
    free_wifi: true,
    age_ranges: ['1-8']
  },
  {
    name: 'Rainbow Soft Play',
    slug: 'rainbow-soft-play',
    city_slug: 'hull',
    address: '89 Cottingham Road',
    postcode: 'HU5 2DG',
    lat: 53.7612,
    lng: -0.3501,
    phone: '01234 567895',
    description: 'A friendly, family-run soft play with a focus on inclusive play for all children. We offer regular SEN sessions with reduced lighting and quieter music.',
    opening_hours: {
      monday: { open: '09:30', close: '17:00' },
      tuesday: { open: '09:30', close: '17:00' },
      wednesday: { open: '09:30', close: '17:00' },
      thursday: { open: '09:30', close: '17:00' },
      friday: { open: '09:30', close: '17:00' },
      saturday: { open: '10:00', close: '17:00' },
      sunday: { open: '10:00', close: '16:00' }
    },
    price_range: '£5.00 per child',
    cafe: true,
    parking: true,
    parties: true,
    toddler_area: true,
    baby_area: true,
    sen_friendly: true,
    wheelchair_access: true,
    free_wifi: false,
    age_ranges: ['0-2', '2-5', '5-10']
  },
  {
    name: 'Pirate Pete\'s Play Ship',
    slug: 'pirate-petes-play-ship',
    city_slug: 'hull',
    address: '34 Newland Avenue',
    postcode: 'HU5 3BG',
    lat: 53.7567,
    lng: -0.3545,
    phone: '01234 567896',
    description: 'Ahoy mateys! A pirate-themed soft play adventure with a ship-shaped play frame, treasure hunt activities, and swashbuckling fun for all ages.',
    opening_hours: {
      monday: { open: '10:00', close: '18:00' },
      tuesday: { open: '10:00', close: '18:00' },
      wednesday: { open: '10:00', close: '18:00' },
      thursday: { open: '10:00', close: '18:00' },
      friday: { open: '10:00', close: '18:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: { open: '10:00', close: '17:00' }
    },
    price_range: '£5.95 per child',
    cafe: true,
    parking: false,
    parties: true,
    toddler_area: true,
    baby_area: false,
    sen_friendly: false,
    wheelchair_access: true,
    free_wifi: true,
    age_ranges: ['2-10']
  },
  {
    name: 'Sunshine Play Centre',
    slug: 'sunshine-play-centre',
    city_slug: 'hull',
    address: '156 Beverley Road',
    postcode: 'HU3 1YA',
    lat: 53.7534,
    lng: -0.3412,
    phone: '01234 567897',
    description: 'A bright and cheerful play centre with indoor and outdoor play areas. Features include trampolines, ball cannons, and a sensory room for SEN children.',
    opening_hours: {
      monday: { open: '09:00', close: '17:30' },
      tuesday: { open: '09:00', close: '17:30' },
      wednesday: { open: '09:00', close: '17:30' },
      thursday: { open: '09:00', close: '17:30' },
      friday: { open: '09:00', close: '18:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: { open: '10:00', close: '17:00' }
    },
    price_range: '£5.50 per child',
    cafe: true,
    parking: true,
    parties: true,
    toddler_area: true,
    baby_area: true,
    sen_friendly: true,
    wheelchair_access: true,
    free_wifi: true,
    age_ranges: ['0-2', '2-5', '5-11']
  },
  {
    name: 'The Play Pit',
    slug: 'the-play-pit',
    city_slug: 'hull',
    address: '67 Chanterlands Avenue',
    postcode: 'HU5 3TJ',
    lat: 53.7589,
    lng: -0.3567,
    phone: '01234 567898',
    description: 'A cosy neighbourhood soft play perfect for younger children. Features include ball pits, soft climbing frames, and a lovely cafe with homemade cakes.',
    opening_hours: {
      monday: { open: '09:30', close: '16:30' },
      tuesday: { open: '09:30', close: '16:30' },
      wednesday: { open: '09:30', close: '16:30' },
      thursday: { open: '09:30', close: '16:30' },
      friday: { open: '09:30', close: '16:30' },
      saturday: { open: '10:00', close: '16:00' },
      sunday: { open: 'closed', close: 'closed' }
    },
    price_range: '£4.50 per child',
    cafe: true,
    parking: false,
    parties: true,
    toddler_area: true,
    baby_area: true,
    sen_friendly: false,
    wheelchair_access: false,
    free_wifi: true,
    age_ranges: ['0-2', '2-6']
  },
  {
    name: 'Wild Woods Indoor Play',
    slug: 'wild-woods-indoor-play',
    city_slug: 'hull',
    address: '223 Willerby Road',
    postcode: 'HU5 5JT',
    lat: 53.7501,
    lng: -0.3789,
    phone: '01234 567899',
    description: 'A woodland-themed adventure play with tree houses, rope bridges, and forest creatures. Great for birthday parties with themed party rooms.',
    opening_hours: {
      monday: { open: '10:00', close: '18:00' },
      tuesday: { open: '10:00', close: '18:00' },
      wednesday: { open: '10:00', close: '18:00' },
      thursday: { open: '10:00', close: '18:00' },
      friday: { open: '10:00', close: '19:00' },
      saturday: { open: '09:00', close: '19:00' },
      sunday: { open: '10:00', close: '17:00' }
    },
    price_range: '£6.00 - £7.50 per child',
    cafe: true,
    parking: true,
    parties: true,
    toddler_area: true,
    baby_area: false,
    sen_friendly: false,
    wheelchair_access: true,
    free_wifi: true,
    age_ranges: ['2-12']
  }
]

async function seedVenues() {
  const client = await pool.connect()
  try {
    console.log('Seeding Hull venues...\n')

    for (const venue of hullVenues) {
      const result = await client.query(`
        INSERT INTO venues (
          name, slug, city_slug, address, postcode, lat, lng, phone, website, booking_url,
          description, opening_hours, price_range, cafe, parking, parties, toddler_area,
          baby_area, sen_friendly, wheelchair_access, free_wifi, age_ranges, last_verified_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP
        )
        ON CONFLICT (city_slug, slug) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          opening_hours = EXCLUDED.opening_hours,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [
        venue.name, venue.slug, venue.city_slug, venue.address, venue.postcode,
        venue.lat || null, venue.lng || null, venue.phone || null, venue.website || null, venue.booking_url || null,
        venue.description, JSON.stringify(venue.opening_hours), venue.price_range,
        venue.cafe, venue.parking, venue.parties, venue.toddler_area,
        venue.baby_area, venue.sen_friendly, venue.wheelchair_access, venue.free_wifi,
        venue.age_ranges || []
      ])

      console.log(`Added: ${venue.name}`)
    }

    console.log(`\nSeeded ${hullVenues.length} venues for Hull!`)

  } catch (error) {
    console.error('Error seeding venues:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

seedVenues()
