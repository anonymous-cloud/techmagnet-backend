const { Worker } = require('bullmq');
const taskJobService = require('../services/taskJobService');
const { redisConnection } = require('../config/queue');
const { testConnection } = require('../config/db');
const logger = require('../utils/logger');
const crypto = require('crypto');
const os = require('os');

async function startWorker() {
  try {
    // Ensure DB connection is active before worker processes jobs
    await testConnection();
    
    logger.info('Task Queue Worker is starting...');

    // 1. Acquire distributed single-worker lock in Redis
    const lockKey = 'techmagnet:worker:active-lock';
    const lockTtl = 10000; // 10 seconds lease
    const workerId = `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString('hex')}`;
    
    // Try to acquire the lock
    const acquired = await redisConnection.set(lockKey, workerId, 'PX', lockTtl, 'NX');
    if (!acquired) {
      const currentWorker = await redisConnection.get(lockKey);
      logger.error('CRITICAL: Another worker process is already active. Exiting to prevent duplicate queue consumption.', {
        currentWorker,
        attemptedWorker: workerId
      });
      process.exit(1);
    }

    logger.info('Successfully acquired active worker lock.', { workerId });

    // 2. Start heartbeat to renew lock lease
    const heartbeatInterval = setInterval(async () => {
      try {
        const currentWorker = await redisConnection.get(lockKey);
        if (currentWorker === workerId) {
          await redisConnection.set(lockKey, workerId, 'PX', lockTtl);
        } else {
          logger.error('CRITICAL: Worker lock was taken by another instance or expired. Exiting process.', { workerId });
          process.exit(1);
        }
      } catch (err) {
        logger.error('Error during worker lock heartbeat renewal', { error: err.message });
      }
    }, 5000);

    // 3. Initialize BullMQ Worker
    const worker = new Worker(
      'dataforseo-task-queue',
      async (job) => {
        try {
          // Attach worker runtime metadata to job.data for logging
          job.data.workerInstance = workerId;
          await taskJobService.processJob(job);
        } catch (error) {
          logger.error('Error processing job in worker callback', { jobId: job.id, error: error.message, workerId });
          if (error.isNonRetryable) {
            logger.info(`Non-retryable failure detected. Discarding remaining retries for job ${job.id}.`);
            try {
              await job.discard();
            } catch (discardErr) {
              logger.error('Failed to discard job retries', { jobId: job.id, error: discardErr.message });
            }
          }
          throw error; // Re-throw to let BullMQ mark job as failed
        }
      },
      {
        connection: redisConnection,
        concurrency: 2 // process up to 2 jobs concurrently
      }
    );

    worker.on('completed', (job) => {
      logger.info('Worker completed job', { jobId: job.id, taskId: job.data.taskId || 'batch', workerId });
    });

    worker.on('failed', (job, err) => {
      logger.error('Worker job failed', { jobId: job?.id, error: err.message, workerId });
    });

    logger.info('Task Queue Worker has started successfully and is listening for jobs.');

    // 4. Graceful Shutdown handlers
    let isShuttingDown = false;
    const shutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      logger.info(`Received ${signal}. Gracefully shutting down worker...`);
      
      clearInterval(heartbeatInterval);
      
      try {
        await worker.close();
        logger.info('BullMQ worker closed.');
      } catch (err) {
        logger.error('Error closing BullMQ worker', { error: err.message });
      }
      
      try {
        const currentWorker = await redisConnection.get(lockKey);
        if (currentWorker === workerId) {
          await redisConnection.del(lockKey);
          logger.info('Worker lock released.');
        }
      } catch (err) {
        logger.error('Error releasing worker lock', { error: err.message });
      }

      try {
        await redisConnection.quit();
        logger.info('Redis connection closed.');
      } catch (err) {
        logger.error('Error disconnecting Redis client', { error: err.message });
      }
      
      logger.info('Shutdown complete. Exiting process.');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error('Failed to start worker', { error: error.message });
    process.exit(1);
  }
}

// Start worker
startWorker();

