const taskRepository = require('../repositories/taskRepository');
const taskJobRepository = require('../repositories/taskJobRepository');
const dataForSeoService = require('./dataForSeoService');
const logger = require('../utils/logger');
const { ValidationError, RecordNotFoundError } = require('../errors');

class TaskJobService {
  /**
   * Processes a queued job (handles both single and batch tasks)
   * @param {Object} job - BullMQ Job object
   */
  async processJob(job) {
    const jobId = job.id;
    const jobName = job.name;

    if (!job.data || typeof job.data !== 'object') {
      throw new ValidationError(`Job data must be a valid object, received: ${typeof job.data}`);
    }

    const { type, taskId, tasks, workerInstance } = job.data;
    logger.info('Worker received job', { jobId, jobName, type: type || 'SINGLE_TASK', taskId, workerInstance });

    if (jobName === 'processTaskBatch') {
      if (type !== 'BULK_TASK_BATCH') {
        throw new ValidationError(`Job name is processTaskBatch but payload type is: ${type}`);
      }
      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new ValidationError('Job payload for processTaskBatch must contain a non-empty tasks array');
      }
      await this.processBulkBatch(jobId, tasks, workerInstance);
    } else if (jobName === 'processTask') {
      if (taskId === undefined || taskId === null || isNaN(Number(taskId))) {
        throw new ValidationError(`Job payload for processTask must contain a valid taskId, received: ${taskId}`);
      }
      await this.processSingleTask(jobId, taskId, workerInstance);
    } else {
      throw new ValidationError(`Unknown job name: ${jobName}`);
    }
  }

  /**
   * Process a single task
   */
  async processSingleTask(jobId, taskId, workerInstance) {
    try {
      const task = await taskRepository.findById(taskId);
      if (!task) {
        throw new RecordNotFoundError(`Task with ID ${taskId} not found in database`);
      }

      logger.info('Processing single task', { jobId, taskId, keyword: task.keyword, workerInstance });

      // 1. Update status to PROCESSING
      await taskRepository.update(taskId, { status_message: 'PROCESSING' });
      await taskJobRepository.updateByTaskId(taskId, { status: 'PROCESSING' });

      // 2. Call DataForSEO API
      const result = await dataForSeoService.fetchSERPData([task]);
      const apiTask = result.tasks[0];

      // 3. Map and update database
      if (apiTask && apiTask.status_code === 20000) {
        const costVal = parseFloat(apiTask.cost || 0);
        const execTimeStr = apiTask.time ? apiTask.time.replace(' sec', '') : '0';
        const execTimeVal = parseFloat(execTimeStr);

        await taskRepository.update(taskId, {
          task_id: apiTask.id,
          status_code: apiTask.status_code,
          status_message: 'COMPLETED',
          cost: costVal,
          execution_time: execTimeVal
        });

        await taskJobRepository.updateByTaskId(taskId, { status: 'COMPLETED' });
        logger.info('Job completed successfully', { jobId, taskId, workerInstance });
      } else {
        const errMsg = apiTask ? apiTask.status_message : 'Unknown DataForSEO task failure';
        const errCode = apiTask ? apiTask.status_code : 500;

        await taskRepository.update(taskId, {
          status_code: errCode,
          status_message: 'FAILED'
        });

        await taskJobRepository.updateByTaskId(taskId, {
          status: 'FAILED',
          error_message: errMsg
        });

        logger.error('DataForSEO task failed', { jobId, taskId, errMsg, workerInstance });
      }
    } catch (error) {
      logger.error('Worker failed job', { jobId, taskId, error: error.message, workerInstance });
      
      // Attempt status updates in DB if taskId is valid
      if (taskId !== undefined && taskId !== null && !isNaN(Number(taskId))) {
        await taskRepository.update(taskId, {
          status_code: 500,
          status_message: 'FAILED'
        }).catch(() => {});

        await taskJobRepository.updateByTaskId(taskId, {
          status: 'FAILED',
          error_message: error.message
        }).catch(() => {});
      }

      throw error;
    }
  }

  /**
   * Process a bulk batch of tasks
   */
  async processBulkBatch(jobId, tasks, workerInstance) {
    const taskIds = tasks.map(t => t.id);
    
    try {
      logger.info('Processing bulk task batch', { jobId, size: tasks.length, workerInstance });

      // 1. Update status to PROCESSING for all tasks & jobs in batch
      for (const taskId of taskIds) {
        await taskRepository.update(taskId, { status_message: 'PROCESSING' });
      }
      await taskJobRepository.updateByJobId(jobId, { status: 'PROCESSING' });

      // 2. Call DataForSEO API with batch of tasks
      const result = await dataForSeoService.fetchSERPData(tasks);
      const apiTasks = result.tasks;

      // 3. Map responses back using array index
      for (let i = 0; i < tasks.length; i++) {
        const localTask = tasks[i];
        const apiTask = apiTasks[i];

        if (apiTask && apiTask.status_code === 20000) {
          const costVal = parseFloat(apiTask.cost || 0);
          const execTimeStr = apiTask.time ? apiTask.time.replace(' sec', '') : '0';
          const execTimeVal = parseFloat(execTimeStr);

          await taskRepository.update(localTask.id, {
            task_id: apiTask.id,
            status_code: apiTask.status_code,
            status_message: 'COMPLETED',
            cost: costVal,
            execution_time: execTimeVal
          });

          await taskJobRepository.updateByTaskId(localTask.id, { status: 'COMPLETED' });
        } else {
          const errMsg = apiTask ? apiTask.status_message : 'Task failed during batch execution';
          const errCode = apiTask ? apiTask.status_code : 500;

          await taskRepository.update(localTask.id, {
            status_code: errCode,
            status_message: 'FAILED'
          });

          await taskJobRepository.updateByTaskId(localTask.id, {
            status: 'FAILED',
            error_message: errMsg
          });
        }
      }

      await taskJobRepository.updateByJobId(jobId, { status: 'COMPLETED' });
      logger.info('Job completed successfully', { jobId, taskCount: tasks.length, workerInstance });

    } catch (error) {
      logger.error('Worker failed batch job', { jobId, error: error.message, workerInstance });

      // Update all tasks & jobs to failed if IDs are valid
      for (const taskId of taskIds) {
        if (taskId !== undefined && taskId !== null && !isNaN(Number(taskId))) {
          await taskRepository.update(taskId, {
            status_code: 500,
            status_message: 'FAILED'
          }).catch(() => {});
        }
      }

      if (jobId) {
        await taskJobRepository.updateByJobId(jobId, {
          status: 'FAILED',
          error_message: error.message
        }).catch(() => {});
      }

      throw error;
    }
  }
}

module.exports = new TaskJobService();

