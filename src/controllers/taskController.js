const { createTask, createBulkTasks } = require('../services/taskService');
const { parseCsv } = require('../services/csvParserService');
const { validateCsvRows } = require('../services/csvValidationService');
const { batchProcessor } = require('../utils/batchProcessor');
const logger = require('../utils/logger');

/**
 * Controller for task creation
 * Handles HTTP request/response for task creation endpoint
 */
const taskController = {
  /**
   * Creates a new task
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async createTask(req, res, next) {
    try {
      const { keyword, language, location, priority } = req.body;
      logger.info('Task creation request received', { keyword });

      const result = await createTask(
        { keyword, language, location, priority },
        req.get('Idempotency-Key')
      );

      res.status(201).json({
        success: result.status === 'success',
        data: result,
        message: result.status === 'success'
          ? 'Task created successfully'
          : 'Task created but processing failed'
      });

    } catch (error) {
      next(error);
    }
  },

  async uploadTasks(req, res, next) {
    try {
      logger.info('Bulk task upload request received', {
        fileName: req.file.originalname,
        fileSize: req.file.size
      });

      const rows = parseCsv(req.file.buffer);
      const validationResult = validateCsvRows(rows);

      const batches = batchProcessor(validationResult.validRows, 100);
      const createdBatchJobs = [];

      if (batches.length > 0) {
        for (const batch of batches) {
          const job = await createBulkTasks(batch);
          createdBatchJobs.push({ jobId: job.id, batchSize: batch.length });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          fileName: req.file.originalname,
          totalRows: validationResult.totalRows,
          validRows: validationResult.validRows.length,
          invalidRows: validationResult.invalidRows.length,
          invalidDetails: validationResult.invalidRows,
          batchesCreated: createdBatchJobs.length,
          batchJobs: createdBatchJobs
        },
        message: 'CSV validated and bulk tasks queued successfully'
      });
    } catch (error) {
      logger.error('Bulk CSV upload failed', { error: error.message });
      next(error);
    }
  }
};

module.exports = taskController;
