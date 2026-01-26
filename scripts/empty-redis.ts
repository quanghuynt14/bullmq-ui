import IORedis from 'ioredis'

/**
 * Script to empty all data from Redis
 * WARNING: This will delete ALL data in the Redis database
 */
async function emptyRedis() {
  console.log('🔌 Connecting to Redis...')

  const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_DB || '0'),
  })

  try {
    console.log('⚠️  WARNING: This will delete ALL data in Redis!')
    console.log('⏳ Flushing Redis database...')

    await connection.flushdb()

    console.log('✅ Redis database emptied successfully!')
  } catch (error) {
    console.error('❌ Error emptying Redis:', error)
    process.exit(1)
  } finally {
    await connection.quit()
    console.log('👋 Disconnected from Redis')
  }
}

emptyRedis()
