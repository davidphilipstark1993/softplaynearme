#!/usr/bin/env node
/**
 * Import Google ratings collected from softplaynearme.net
 *
 * Matches venues by city_slug + fuzzy name, updates rating & reviews_count
 *
 * Usage:
 *   node scripts/import-ratings-from-net.mjs
 *   node scripts/import-ratings-from-net.mjs --dry-run
 */

import pg from 'pg'
const { Pool } = pg

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('DATABASE_URL is not set. Export it or run via a tool that loads .env.local.')
  process.exit(1)
}
const DRY_RUN = process.argv.includes('--dry-run')

// ─── COLLECTED RATINGS ───────────────────────────────────────────────────────
// Sourced from softplaynearme.net (real Google ratings)
// city must match the city_slug column in the DB
const COLLECTED_RATINGS = [
  // LEEDS
  { city: 'leeds', name: 'Grass Hoppers', rating: 4.4, reviews: 204 },
  { city: 'leeds', name: 'Tumble Town', rating: 4.4, reviews: 179 },
  { city: 'leeds', name: 'RugRatz', rating: 4.1, reviews: 510 },
  { city: 'leeds', name: 'Junglecatz', rating: 4.4, reviews: 180 },
  { city: 'leeds', name: 'The Hidden Village', rating: 4.8, reviews: 144 },
  { city: 'leeds', name: 'Kids Club House', rating: 4.8, reviews: 1230 },
  { city: 'leeds', name: 'Kidzplay', rating: 4.1, reviews: 623 },
  { city: 'leeds', name: 'Tiny Boo', rating: 4.6, reviews: 45 },
  { city: 'leeds', name: 'Monkey Maze', rating: 4.6, reviews: 723 },
  { city: 'leeds', name: 'Munchkins', rating: 4.3, reviews: 262 },
  { city: 'leeds', name: 'Little Leeds', rating: 4.1, reviews: 15 },
  { city: 'leeds', name: 'Kidzone', rating: 4.0, reviews: 276 },
  { city: 'leeds', name: 'Monster Kidz Beeston', rating: 4.2, reviews: 886 },
  { city: 'leeds', name: 'Monster Kidz', rating: 4.2, reviews: 510 },

  // YORK
  { city: 'york', name: 'Flying Legends Wacky Warehouse', rating: 4.0, reviews: 746 },
  { city: 'york', name: 'The Web Adventure Park', rating: 4.5, reviews: 2133 },
  { city: 'york', name: 'Oxygen York', rating: 4.3, reviews: 84 },
  { city: 'york', name: 'Flip Out York', rating: 4.5, reviews: 1113 },
  { city: 'york', name: 'Burnholme Sports Centre', rating: 4.6, reviews: 105 },
  { city: 'york', name: 'York Leisure Centre', rating: 4.2, reviews: 125 },

  // SHEFFIELD
  { city: 'sheffield', name: 'Play Valley Sheffield', rating: 4.5, reviews: 401 },
  { city: 'sheffield', name: 'Tiny Town Ltd', rating: 4.9, reviews: 99 },
  { city: 'sheffield', name: 'Play Valley Dinnington', rating: 4.4, reviews: 994 },
  { city: 'sheffield', name: 'Jungle Monkeys', rating: 4.8, reviews: 100 },
  { city: 'sheffield', name: 'Playmania Sheffield', rating: 4.8, reviews: 243 },
  { city: 'sheffield', name: 'Fun House Play Centre', rating: 4.1, reviews: 206 },
  { city: 'sheffield', name: 'Runaround Play Centre', rating: 4.2, reviews: 716 },
  { city: 'sheffield', name: 'Treasure Island', rating: 4.3, reviews: 12 },
  { city: 'sheffield', name: 'Curious Kids Town', rating: 4.3, reviews: 113 },
  { city: 'sheffield', name: 'PandyLand', rating: 4.6, reviews: 50 },
  { city: 'sheffield', name: 'Monkey Bizness Sheffield', rating: 4.2, reviews: 995 },
  { city: 'sheffield', name: 'Medieval Mayhem', rating: 4.3, reviews: 748 },
  { city: 'sheffield', name: 'Playtimes Playtown Sensory & Imaginary Role Play Centre', rating: 4.9, reviews: 12 },

  // PORTSMOUTH
  { city: 'portsmouth', name: 'PlayZone', rating: 4.1, reviews: 1279 },
  { city: 'portsmouth', name: 'Sovereigns Wacky Warehouse', rating: 4.5, reviews: 51 },
  { city: 'portsmouth', name: 'Teeny Town', rating: 4.4, reviews: 100 },
  { city: 'portsmouth', name: 'Farmhouse Wacky Warehouse', rating: 3.8, reviews: 98 },

  // SWANSEA
  { city: 'swansea', name: 'The Swansea Children\'s Centre', rating: 4.9, reviews: 42 },
  { city: 'swansea', name: 'Playzone', rating: 4.2, reviews: 909 },
  { city: 'swansea', name: 'Kids Play Hub', rating: 4.5, reviews: 99 },
  { city: 'swansea', name: 'Funky Fun Factory', rating: 4.2, reviews: 44 },
  { city: 'swansea', name: "Brodie's Funhouse Indoor Play Centre", rating: 4.7, reviews: 69 },
  { city: 'swansea', name: 'UPTOWN FUN LTD', rating: 4.7, reviews: 54 },
  { city: 'swansea', name: 'Limitless Activity Centre Swansea', rating: 4.3, reviews: 946 },
  { city: 'swansea', name: 'Crazyclimb Swansea', rating: 4.7, reviews: 58 },
  { city: 'swansea', name: 'Flashpoint Swansea', rating: 4.5, reviews: 121 },
  { city: 'swansea', name: 'Ty Hapus', rating: 4.1, reviews: 96 },
  { city: 'swansea', name: 'Funsters Play Factory', rating: 4.0, reviews: 16 },
  { city: 'swansea', name: 'Simply Play', rating: 4.3, reviews: 125 },
  { city: 'swansea', name: 'Kiddy Chaos Indoor Play Centre', rating: 3.3, reviews: 38 },
  { city: 'swansea', name: "Crazy Town's Play Den", rating: 4.4, reviews: 36 },

  // DONCASTER
  { city: 'doncaster', name: 'Play Valley Doncaster', rating: 4.7, reviews: 492 },
  { city: 'doncaster', name: 'Uproar! Play Barn', rating: 4.2, reviews: 105 },
  { city: 'doncaster', name: "Charley's Play Barn", rating: 4.8, reviews: 14 },
  { city: 'doncaster', name: 'Flip Out Doncaster', rating: 4.0, reviews: 710 },
  { city: 'doncaster', name: 'JungleMazeia Soft Play Children Activity Centre', rating: 3.8, reviews: 149 },
  { city: 'doncaster', name: "Thee Fuzzy Ed's", rating: 4.2, reviews: 52 },
  { city: 'doncaster', name: 'Astrabound', rating: 4.4, reviews: 763 },
  { city: 'doncaster', name: 'Kidz hub ltd', rating: 4.4, reviews: 146 },
  { city: 'doncaster', name: 'Time 2 Play', rating: 4.0, reviews: 77 },

  // BOURNEMOUTH
  { city: 'bournemouth', name: 'Oasis Fun Bournemouth', rating: 4.2, reviews: 969 },
  { city: 'bournemouth', name: 'Itsy Bitsyccino', rating: 4.9, reviews: 54 },
  { city: 'bournemouth', name: 'Kids Play Cafe - Charminster', rating: 4.6, reviews: 233 },
  { city: 'bournemouth', name: 'Stay & Play Cafe', rating: 4.8, reviews: 39 },
  { city: 'bournemouth', name: 'Science Zone UK', rating: 4.5, reviews: 68 },

  // CARDIFF
  { city: 'cardiff', name: 'Parc Play Ltd', rating: 4.3, reviews: 477 },
  { city: 'cardiff', name: 'Mambo Play Centre Cardiff', rating: 4.3, reviews: 1722 },
  { city: 'cardiff', name: 'Zone Play Cardiff', rating: 4.2, reviews: 337 },
  { city: 'cardiff', name: 'Ants Inya Pants', rating: 4.2, reviews: 247 },
  { city: 'cardiff', name: 'Jump Cardiff', rating: 4.0, reviews: 839 },
  { city: 'cardiff', name: 'Fun HQ Cardiff', rating: 3.8, reviews: 150 },
  { city: 'cardiff', name: 'Melrose Inn Wacky Warehouse', rating: 4.0, reviews: 120 },
  { city: 'cardiff', name: 'Jellybugs Soft Play', rating: 3.0, reviews: 2 },
  { city: 'cardiff', name: 'Tee-Rex Adventure Golf Cardiff', rating: 4.5, reviews: 314 },
  { city: 'cardiff', name: 'Amaze Playz', rating: 3.9, reviews: 89 },

  // NORWICH
  { city: 'norwich', name: 'Explorers Soft Play', rating: 4.4, reviews: 52 },
  { city: 'norwich', name: 'Hyper Centre Soft Play', rating: 4.3, reviews: 464 },
  { city: 'norwich', name: 'The Playbarn', rating: 4.4, reviews: 389 },
  { city: 'norwich', name: 'Jump For Joy', rating: 4.4, reviews: 256 },
  { city: 'norwich', name: 'Tots Town Children\'s Roleplay Centre', rating: 4.7, reviews: 217 },
  { city: 'norwich', name: 'Ragged Rascals', rating: 4.1, reviews: 9 },
  { city: 'norwich', name: 'Twinkle Toes Soft Play Baby Cafe', rating: 4.6, reviews: 48 },
  { city: 'norwich', name: 'Si5 Spy Missions', rating: 4.5, reviews: 26 },
  { city: 'norwich', name: 'Namco Funscape', rating: 4.1, reviews: 1312 },

  // GLASGOW
  { city: 'glasgow', name: 'Wonder World Soft Play East Kilbride', rating: 4.1, reviews: 954 },
  { city: 'glasgow', name: 'Fun Street Soft Play Glasgow', rating: 4.1, reviews: 416 },
  { city: 'glasgow', name: 'WeePlay Soft Play & Party Venue', rating: 4.7, reviews: 247 },
  { city: 'glasgow', name: 'Wonder World Soft Play Glasgow', rating: 4.1, reviews: 2172 },
  { city: 'glasgow', name: 'Lollipop Land', rating: 3.3, reviews: 103 },
  { city: 'glasgow', name: 'Softplay at Kelvinhall', rating: 4.6, reviews: 160 },
  { city: 'glasgow', name: 'Adventure Planet Cumbernauld', rating: 3.3, reviews: 227 },
  { city: 'glasgow', name: 'Play Town Softplay', rating: 4.4, reviews: 240 },
  { city: 'glasgow', name: 'Kids Complex', rating: 4.3, reviews: 259 },
  { city: 'glasgow', name: 'City Kids Adventure Play', rating: 4.3, reviews: 192 },
  { city: 'glasgow', name: 'Inflata Nation Soft Play Inflatable Park Glasgow', rating: 4.2, reviews: 448 },
  { city: 'glasgow', name: 'Sportykids Softplay', rating: 4.4, reviews: 295 },
  { city: 'glasgow', name: 'Jurassic Jungle', rating: 4.1, reviews: 301 },
  { city: 'glasgow', name: 'Wild Adventure Soft Play Drumchapel', rating: 4.3, reviews: 104 },
  { city: 'glasgow', name: 'Gravity Active Glasgow', rating: 4.3, reviews: 642 },
  { city: 'glasgow', name: 'Wee Playhouse East Kilbride', rating: 4.2, reviews: 94 },
  { city: 'glasgow', name: 'Campsie Soft Play', rating: 5.0, reviews: 10 },
  { city: 'glasgow', name: 'Kiltoonies', rating: 4.9, reviews: 105 },

  // EDINBURGH
  { city: 'edinburgh', name: 'Wonder World Soft Play Edinburgh', rating: 4.0, reviews: 1608 },
  { city: 'edinburgh', name: 'Timetwisters Play Centre', rating: 4.1, reviews: 525 },
  { city: 'edinburgh', name: 'Clambers', rating: 4.5, reviews: 79 },
  { city: 'edinburgh', name: 'Tumbles Portobello Gymnastics and Softplay', rating: 4.3, reviews: 569 },
  { city: 'edinburgh', name: 'Ocean Play Ltd', rating: 3.9, reviews: 203 },
  { city: 'edinburgh', name: 'Gymboree', rating: 4.7, reviews: 35 },
  { city: 'edinburgh', name: 'Gravity Active Edinburgh', rating: 4.3, reviews: 594 },

  // BRIGHTON
  { city: 'brighton', name: 'Funplex', rating: 3.8, reviews: 469 },
  { city: 'brighton', name: 'Palace Play', rating: 4.2, reviews: 77 },
  { city: 'brighton', name: 'WRAP Play Event Space', rating: 4.6, reviews: 71 },

  // NOTTINGHAM
  { city: 'nottingham', name: 'Fun Valley Nottingham', rating: 3.7, reviews: 84 },
  { city: 'nottingham', name: 'Tumble Town Play Centre Ltd', rating: 4.0, reviews: 142 },
  { city: 'nottingham', name: 'Pirates Play Party & Laser Centre', rating: 4.2, reviews: 756 },
  { city: 'nottingham', name: 'Hocus Pocus Soft Play and Party Venue', rating: 4.3, reviews: 313 },
  { city: 'nottingham', name: 'Mighty Monsters', rating: 4.7, reviews: 26 },
  { city: 'nottingham', name: 'Oceans Of Fun', rating: 4.0, reviews: 98 },
  { city: 'nottingham', name: 'Plank & Leggit Wacky Warehouse', rating: 4.5, reviews: 69 },
  { city: 'nottingham', name: 'Tiny Town Adventures Role Play Centre', rating: 4.9, reviews: 217 },
  { city: 'nottingham', name: 'Squiggles Playden', rating: 4.4, reviews: 449 },
  { city: 'nottingham', name: 'Escape Play Ltd', rating: 3.7, reviews: 553 },
  { city: 'nottingham', name: 'Mousetrap Soft Play', rating: 4.0, reviews: 499 },
  { city: 'nottingham', name: 'Ed & Molly\'s Playbarn', rating: 4.4, reviews: 518 },
  { city: 'nottingham', name: 'Beekeeper Wacky Warehouse', rating: 4.0, reviews: 72 },
  { city: 'nottingham', name: 'Planet Bounce Inflatable Park Nottingham', rating: 4.2, reviews: 1275 },
  { city: 'nottingham', name: 'Robyn\'s World', rating: 5.0, reviews: 24 },
  { city: 'nottingham', name: 'Freestyle Trampoline Park Soft Play and Inflatable', rating: 4.6, reviews: 1073 },
  { city: 'nottingham', name: 'Cyrils Fun House', rating: 4.3, reviews: 179 },

  // COLCHESTER
  { city: 'colchester', name: 'Jungle Adventure Ltd', rating: 3.3, reviews: 135 },
  { city: 'colchester', name: 'Go Bananas', rating: 3.9, reviews: 190 },
  { city: 'colchester', name: 'AirHop Trampoline Park Colchester', rating: 4.4, reviews: 962 },

  // NEWCASTLE
  { city: 'newcastle', name: 'Apple Tree Town', rating: 4.6, reviews: 224 },
  { city: 'newcastle', name: 'Jumbo Fun & Play', rating: 4.0, reviews: 589 },
  { city: 'newcastle', name: 'Cheeky Monkeys', rating: 4.1, reviews: 356 },

  // BLACKPOOL
  { city: 'blackpool', name: 'Bounce Play Centre', rating: 4.5, reviews: 1028 },
  { city: 'blackpool', name: 'Planet Kaos', rating: 4.3, reviews: 344 },
  { city: 'blackpool', name: 'Smart Play', rating: 4.0, reviews: 119 },
  { city: 'blackpool', name: 'AirHop Adventure & Trampoline Park Blackpool', rating: 4.4, reviews: 916 },
  { city: 'blackpool', name: 'The Gruffalo & Friends Clubhouse', rating: 4.6, reviews: 333 },
  { city: 'blackpool', name: 'Peter Rabbit Explore and Play Blackpool', rating: 3.7, reviews: 238 },
  { city: 'blackpool', name: 'Jungle Mania Blackpool', rating: 4.2, reviews: 80 },
  { city: 'blackpool', name: 'Air Balloon Wacky Warehouse', rating: 4.3, reviews: 43 },
  { city: 'blackpool', name: 'Beach Amusements', rating: 3.9, reviews: 20 },

  // SUNDERLAND
  { city: 'sunderland', name: "Fuzzy Ed's Fun House Ryhope", rating: 4.1, reviews: 117 },
  { city: 'sunderland', name: 'Tumbles', rating: 4.3, reviews: 213 },
  { city: 'sunderland', name: 'Super Tramp Sunderland Trampoline Park', rating: 4.2, reviews: 264 },
  { city: 'sunderland', name: 'Go Bananas', rating: 4.0, reviews: 327 },
  { city: 'sunderland', name: 'Seldons Leisureworld', rating: 4.2, reviews: 512 },
  { city: 'sunderland', name: 'Adventureland Sunderland', rating: 4.8, reviews: 8 },
  { city: 'sunderland', name: 'The Hidden Den', rating: 4.2, reviews: 36 },
  { city: 'sunderland', name: 'Karting North East', rating: 4.7, reviews: 816 },

  // HULL
  { city: 'hull', name: 'Kinderland Playzone Ltd', rating: 4.0, reviews: 311 },
  { city: 'hull', name: 'Crazy Kids', rating: 3.8, reviews: 184 },
  { city: 'hull', name: 'Adventure Play Town', rating: 4.9, reviews: 59 },
  { city: 'hull', name: 'The Secret Village', rating: 4.7, reviews: 82 },
  { city: 'hull', name: 'Kingstown Wacky Warehouse', rating: 3.7, reviews: 9 },
  { city: 'hull', name: 'Little Monkeys at Active Plus', rating: 4.3, reviews: 210 },
  { city: 'hull', name: 'Big Fun', rating: 4.2, reviews: 1414 },
  { city: 'hull', name: 'Little Astronauts', rating: 4.6, reviews: 203 },
  { city: 'hull', name: 'Monkey Bizness Hull', rating: 4.4, reviews: 993 },
  { city: 'hull', name: 'The Parks Children\'s Centre', rating: 4.4, reviews: 37 },
  { city: 'hull', name: 'Superbowl UK Hull', rating: 4.0, reviews: 713 },
  { city: 'hull', name: 'Rock Up Hull', rating: 4.6, reviews: 553 },

  // LEICESTER
  { city: 'leicester', name: 'Fun Valley Leicester', rating: 3.9, reviews: 231 },
  { city: 'leicester', name: '360 Play Leicester', rating: 3.8, reviews: 526 },
  { city: 'leicester', name: 'Go Kids Go Leicester', rating: 3.9, reviews: 1015 },
  { city: 'leicester', name: 'Skidaddle', rating: 4.2, reviews: 181 },
  { city: 'leicester', name: 'Bees Knees Wacky Warehouse', rating: 3.0, reviews: 26 },
  { city: 'leicester', name: 'Little Cobblers Play Barn', rating: 3.5, reviews: 45 },
  { city: 'leicester', name: 'Parklands Play World', rating: 4.2, reviews: 66 },
  { city: 'leicester', name: 'Rascal Ranch', rating: 4.3, reviews: 265 },
  { city: 'leicester', name: 'Beanies Soft Play', rating: 4.3, reviews: 21 },
  { city: 'leicester', name: 'Northfields Playbarn', rating: 4.3, reviews: 26 },
  { city: 'leicester', name: 'Petite Street Play Village', rating: 4.8, reviews: 46 },
  { city: 'leicester', name: 'Highfields Adventure Playground Association', rating: 4.8, reviews: 23 },
  { city: 'leicester', name: 'Parklands Leisure Centre', rating: 3.7, reviews: 416 },

  // LINCOLN
  { city: 'lincoln', name: 'Playzone', rating: 4.2, reviews: 658 },
  { city: 'lincoln', name: 'Fun Farm Lincoln Family Entertainment Centre', rating: 4.3, reviews: 838 },
  { city: 'lincoln', name: 'Kids Hub Nettleham', rating: 4.0, reviews: 5 },
  { city: 'lincoln', name: 'Krazy Kids Soft Play', rating: 4.6, reviews: 62 },
  { city: 'lincoln', name: 'Springfields Adventure Land', rating: 3.9, reviews: 278 },
  { city: 'lincoln', name: 'Jump Inc Lincoln', rating: 4.4, reviews: 984 },
  { city: 'lincoln', name: 'Bounce Central Lincoln', rating: 4.4, reviews: 66 },

  // BARNSLEY
  { city: 'barnsley', name: 'Playmania Barnsley', rating: 4.5, reviews: 676 },
  { city: 'barnsley', name: 'The Play Village', rating: 4.6, reviews: 68 },
  { city: 'barnsley', name: 'Chestnut Tree Wacky Warehouse', rating: 4.8, reviews: 213 },
  { city: 'barnsley', name: 'TEDZ Play Centre', rating: 4.6, reviews: 7 },
  { city: 'barnsley', name: 'Pirates Cove', rating: 4.2, reviews: 243 },

  // HALIFAX
  { city: 'halifax', name: "PB's Play Village", rating: 4.7, reviews: 187 },
  { city: 'halifax', name: 'The Spinning Top', rating: 4.9, reviews: 11 },
  { city: 'halifax', name: 'Littlelegz SEN Centre and Sensory Room', rating: 4.5, reviews: 243 },
  { city: 'halifax', name: 'Playtopia Play Centre', rating: 4.6, reviews: 321 },
  { city: 'halifax', name: 'Play Palace', rating: 4.1, reviews: 196 },
  { city: 'halifax', name: 'The Play Mill Cafe', rating: 4.5, reviews: 114 },
  { city: 'halifax', name: 'Charlie Fastrax', rating: 3.8, reviews: 92 },
  { city: 'halifax', name: 'Airtime Halifax', rating: 4.4, reviews: 425 },
  { city: 'halifax', name: 'Halifax Indoor Football Centre', rating: 4.6, reviews: 148 },

  // IPSWICH
  { city: 'ipswich', name: 'Partyman World of Play', rating: 4.5, reviews: 714 },
  { city: 'ipswich', name: 'Play2Day Ipswich', rating: 4.3, reviews: 718 },
  { city: 'ipswich', name: 'Jump In AirHop Trampoline Park Soft Play Ipswich', rating: 4.2, reviews: 1637 },
  { city: 'ipswich', name: 'The Play Den', rating: 5.0, reviews: 12 },
  { city: 'ipswich', name: 'Mini Monsters Ipswich', rating: 4.7, reviews: 83 },
  { city: 'ipswich', name: "Yaya's House", rating: 4.3, reviews: 159 },

  // HASTINGS
  { city: 'hastings', name: "Let's Go Play", rating: 4.7, reviews: 128 },
  { city: 'hastings', name: 'Clambers Playcentre', rating: 3.7, reviews: 420 },

  // BRADFORD
  { city: 'bradford', name: 'Funzy', rating: 4.4, reviews: 1077 },
  { city: 'bradford', name: "Geronimo's", rating: 3.8, reviews: 169 },
  { city: 'bradford', name: 'Flip Out Bradford', rating: 3.1, reviews: 144 },
  { city: 'bradford', name: '5 Alive Bradford Adventure Soft Play Centre', rating: 4.2, reviews: 596 },
  { city: 'bradford', name: 'All Aboard Soft Play Bradford', rating: 4.5, reviews: 96 },
  { city: 'bradford', name: 'Wiggles', rating: 4.7, reviews: 81 },
  { city: 'bradford', name: 'Happy Planet Play Centre', rating: 4.8, reviews: 52 },
  { city: 'bradford', name: 'Megaplay Bradford', rating: 3.4, reviews: 616 },
  { city: 'bradford', name: 'Grass Hoppers Indoor & Outdoor Play Tong Garden Centre', rating: 4.5, reviews: 623 },
  { city: 'bradford', name: 'Funsters Childrens Play Bradford', rating: 4.5, reviews: 213 },
  { city: 'bradford', name: 'Insane Air Bradford', rating: 4.6, reviews: 1588 },
  { city: 'bradford', name: 'Bambinis Play Cafe', rating: 4.9, reviews: 48 },
  { city: 'bradford', name: 'SoftPlay Toys4kids Ltd', rating: 4.7, reviews: 25 },
  { city: 'bradford', name: 'Airobounce Trampoline Park Bradford', rating: 4.6, reviews: 1582 },

  // ABERDEEN
  { city: 'aberdeen', name: "Smuggler's Cove", rating: 4.1, reviews: 123 },
  { city: 'aberdeen', name: 'Innoflate Aberdeen', rating: 4.1, reviews: 333 },
  { city: 'aberdeen', name: "Codona's", rating: 4.0, reviews: 3002 },
  { city: 'aberdeen', name: 'Wynford Farm Park', rating: 4.5, reviews: 1115 },
  { city: 'aberdeen', name: 'AirHop Adventure & Trampoline Park Aberdeen', rating: 4.5, reviews: 811 },
  { city: 'aberdeen', name: 'Little Monsters', rating: 3.9, reviews: 65 },
  { city: 'aberdeen', name: 'Osmans', rating: 4.7, reviews: 65 },

  // HUDDERSFIELD
  { city: 'huddersfield', name: 'Fizzy Lizard Play Gym', rating: 4.4, reviews: 368 },
  { city: 'huddersfield', name: 'Inflata Nation Inflatable Theme Park Huddersfield', rating: 4.1, reviews: 160 },
  { city: 'huddersfield', name: 'Playworld Huddersfield', rating: 4.2, reviews: 699 },
  { city: 'huddersfield', name: 'The Magical Forest Playgym', rating: 3.8, reviews: 197 },
  { city: 'huddersfield', name: 'The Fun Factory', rating: 4.4, reviews: 88 },
  { city: 'huddersfield', name: 'Happy Adventures Play Village', rating: 4.7, reviews: 25 },
  { city: 'huddersfield', name: 'Town Playcafe Huddersfield', rating: 4.8, reviews: 154 },
  { city: 'huddersfield', name: 'The Zone', rating: 4.1, reviews: 634 },
  { city: 'huddersfield', name: 'Popkidz', rating: 4.8, reviews: 72 },
  { city: 'huddersfield', name: 'Jelly Beans Under 5s', rating: 4.4, reviews: 86 },
  { city: 'huddersfield', name: 'Leapfrogs Playgym Ltd', rating: 4.1, reviews: 40 },
  { city: 'huddersfield', name: 'High Park Wacky Warehouse', rating: 4.1, reviews: 53 },
  { city: 'huddersfield', name: 'Chez Play', rating: 4.7, reviews: 11 },

  // INVERNESS
  { city: 'inverness', name: 'Innoflate Inverness', rating: 3.8, reviews: 21 },
  { city: 'inverness', name: "Frankie & Lola's Inverness", rating: 4.3, reviews: 640 },
  { city: 'inverness', name: 'Playzone', rating: 4.1, reviews: 160 },

  // BRIDLINGTON
  { city: 'bridlington', name: 'Candy Kingdom', rating: 4.3, reviews: 863 },
  { city: 'bridlington', name: 'Montyzoomers', rating: 2.6, reviews: 31 },

  // BEVERLEY
  { city: 'beverley', name: 'Jack in the Box Soft Play and Role Play', rating: 4.6, reviews: 647 },
  { city: 'beverley', name: 'Jump Inc Adventure & Trampoline Park Beverley', rating: 4.2, reviews: 648 },
  { city: 'beverley', name: 'Let Loose Yorkshire', rating: 4.4, reviews: 327 },

  // BOLTON-PRESTON (combined city_slug in DB)
  { city: 'bolton-preston', name: 'Little Town Playhouse Ltd', rating: 5.0, reviews: 5 },
  { city: 'bolton-preston', name: 'Bee Hive Wacky Warehouse', rating: 4.1, reviews: 127 },
  { city: 'bolton-preston', name: 'Playtopia Play Centre', rating: 4.3, reviews: 94 },
  { city: 'bolton-preston', name: 'Party and Play Funhouse Bolton', rating: 4.1, reviews: 834 },
  { city: 'bolton-preston', name: 'Fun Valley Bolton', rating: 4.4, reviews: 730 },
  { city: 'bolton-preston', name: 'Amazonia Bolton', rating: 4.2, reviews: 401 },
  { city: 'bolton-preston', name: 'Eddie Bears Play House', rating: 4.4, reviews: 112 },
  { city: 'bolton-preston', name: 'Tiger Tumbles Playhouse Ltd', rating: 4.4, reviews: 25 },
  { city: 'bolton-preston', name: "Jollie's Barn", rating: 4.5, reviews: 438 },
  { city: 'bolton-preston', name: 'Phantom Winger Wacky Warehouse', rating: 3.5, reviews: 94 },
  { city: 'bolton-preston', name: "Mini's Party and Play Centre", rating: 4.2, reviews: 323 },
  { city: 'bolton-preston', name: 'Wacky World Inflatable Park', rating: 4.3, reviews: 713 },
  { city: 'bolton-preston', name: 'The Kinder Hub', rating: 4.8, reviews: 110 },
  { city: 'bolton-preston', name: 'Curiosity Corner Play', rating: 4.9, reviews: 130 },
  { city: 'bolton-preston', name: 'Poachers Wacky Warehouse', rating: 4.3, reviews: 25 },
  { city: 'bolton-preston', name: "Rascals Party & Play Centre", rating: 4.4, reviews: 1024 },
  { city: 'bolton-preston', name: "Lil' Monsters Children's Indoor Playhouse", rating: 3.9, reviews: 24 },
  { city: 'bolton-preston', name: 'Monkey Magic', rating: 3.9, reviews: 31 },
]
// ─────────────────────────────────────────────────────────────────────────────

function normalise(str) {
  return str.toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|soft|play|centre|center|ltd|limited|&|and)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a, b) {
  const na = normalise(a)
  const nb = normalise(b)
  if (na === nb) return 1.0

  const ta = new Set(na.split(' ').filter(Boolean))
  const tb = new Set(nb.split(' ').filter(Boolean))
  const inter = [...ta].filter(t => tb.has(t)).length
  const union = new Set([...ta, ...tb]).size
  const jaccard = union > 0 ? inter / union : 0

  const subBonus = (na.includes(nb) || nb.includes(na)) ? 0.2 : 0

  return Math.min(1.0, jaccard + subBonus)
}

const MATCH_THRESHOLD = 0.4

async function main() {
  console.log(`Import Google ratings from softplaynearme.net`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Entries to process: ${COLLECTED_RATINGS.length}\n`)

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  const { rows: dbVenues } = await client.query(`
    SELECT id, name, city_slug, rating, reviews_count
    FROM venues
    WHERE status IS DISTINCT FROM 'closed_permanently'
    ORDER BY city_slug, name
  `)

  const byCity = {}
  for (const v of dbVenues) {
    if (!byCity[v.city_slug]) byCity[v.city_slug] = []
    byCity[v.city_slug].push(v)
  }

  const stats = { matched: 0, updated: 0, skipped_same: 0, unmatched: 0 }
  const unmatched = []

  for (const entry of COLLECTED_RATINGS) {
    const cityVenues = byCity[entry.city] || []
    if (cityVenues.length === 0) {
      console.warn(`  ⚠ No venues in DB for city: ${entry.city}`)
      stats.unmatched++
      unmatched.push(entry)
      continue
    }

    let bestScore = 0
    let bestVenue = null
    for (const v of cityVenues) {
      const score = similarity(entry.name, v.name)
      if (score > bestScore) {
        bestScore = score
        bestVenue = v
      }
    }

    if (bestScore < MATCH_THRESHOLD || !bestVenue) {
      console.warn(`  ✗ No match for "${entry.name}" (${entry.city}) — best: "${bestVenue?.name}" (${bestScore.toFixed(2)})`)
      stats.unmatched++
      unmatched.push(entry)
      continue
    }

    stats.matched++

    const currentRating = bestVenue.rating ? Number(bestVenue.rating) : null
    const currentReviews = bestVenue.reviews_count || null

    if (currentRating === entry.rating && currentReviews === entry.reviews) {
      stats.skipped_same++
      continue
    }

    if (!DRY_RUN) {
      await client.query(
        `UPDATE venues SET rating = $1, reviews_count = $2 WHERE id = $3`,
        [entry.rating, entry.reviews, bestVenue.id]
      )
    }

    console.log(`  ✓ "${bestVenue.name}" (${bestVenue.city_slug}) [${bestScore.toFixed(2)}] ${currentRating ?? '?'}→${entry.rating} (${currentReviews ?? '?'}→${entry.reviews})`)
    stats.updated++
  }

  client.release()
  await pool.end()

  console.log('\n' + '─'.repeat(60))
  console.log(`Matched:        ${stats.matched}`)
  console.log(`Updated:        ${stats.updated}`)
  console.log(`Already same:   ${stats.skipped_same}`)
  console.log(`Unmatched:      ${stats.unmatched}`)

  if (unmatched.length > 0) {
    console.log('\nUnmatched:')
    for (const e of unmatched) {
      console.log(`  ${e.city} | ${e.name} | ${e.rating} | ${e.reviews}`)
    }
  }

  if (!DRY_RUN && stats.updated > 0) {
    console.log('\nNext: node scripts/rebuild-static-json.mjs')
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
