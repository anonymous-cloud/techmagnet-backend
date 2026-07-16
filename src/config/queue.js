const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../utils/logger');
require('dotenv').config();

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis server');
});

redisConnection.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

const taskQueue = new Queue('dataforseo-task-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

module.exports = {
  taskQueue,
  redisConnection
};
