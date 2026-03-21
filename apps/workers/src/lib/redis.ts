import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

let connection: ReturnType<typeof createClient> | null = null

export function getRedisConnection() {
  if (!connection) {
    connection = createClient({ url: redisUrl })
  }
  return connection
}

export async function connectRedis() {
  const client = getRedisConnection()
  if (!client.isOpen) {
    await client.connect()
  }
  return client
}

export async function disconnectRedis() {
  if (connection && connection.isOpen) {
    await connection.quit()
    connection = null
  }
}
