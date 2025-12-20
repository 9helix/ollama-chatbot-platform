const Redis = require('ioredis');

// Create Redis client
const redis = new Redis({
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).port : 6379,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    console.error('Redis connection error:', err);
    return true;
  }
});

redis.on('connect', () => {
  console.log('✓ Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('ready', () => {
  console.log('✓ Redis ready');
});

module.exports = redis;