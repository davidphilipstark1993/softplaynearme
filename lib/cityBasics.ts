/**
 * Lightweight city list — imports ONLY data/cities-basic.json (slug/name/
 * county, ~3KB for all 38 cities), never the full data/cities.json (~142KB,
 * carries long intro paragraphs and FAQs per city).
 *
 * Client components that just need the city list (e.g. SearchForm's
 * autocomplete) should import from here, not from lib/venues.ts, for the
 * same reason lib/staticTowns.ts exists — see that file's comment. A client
 * component importing anything from lib/venues.ts drags its full
 * data/cities.json import into the browser bundle regardless of which
 * fields are actually used.
 *
 * Server components rendering full city page content should keep using
 * lib/venues.ts as before.
 */

import citiesBasicData from '@/data/cities-basic.json'

export interface CityBasic {
  slug: string
  name: string
  county: string
}

export const citiesBasic = citiesBasicData as CityBasic[]
