import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

export function getPool(): Pool {
  if (global.__pgPool) return global.__pgPool

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  if (process.env.NODE_ENV !== 'production') {
    global.__pgPool = pool
  }

  return pool
}
