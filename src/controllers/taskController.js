const taskService = require('../services/taskService');
const { parseCsvFile } = require('../services/csvParserService');
const { validateCsvRows } = require('../services/csvValidationService');
const { validateSingleTask, validateGetTasksQuery } = require('../validators/task.validator');
const { chunkArray } = require('../utils/batchProcessor');
const { AppError } = require('../errors');
const logger = require('../utils/logger');
const fs = require('fs');

/**
 * Creates a single task
 */
async function createTask(req, res, next) {
  try {
    logger.info('Task creation request received', req.body);
    
    // 1. Validate
    validateSingleTask(req.body);
    
    // 2. Call service
    const task = await taskService.createPendingTask(req.body);
    
    if (task.isDuplicate) {
      return res.status(200).json({
        success: true,
        data: {
          taskId: task.id,
          keyword: task.keyword,
          status: task.status_message,
          cost: task.cost,
          executionTime: task.execution_time
        },
        message: 'Deterministic duplicate found; returning existing task'
      });
    }

    res.status(201).json({
      success: true,
      data: {
        taskId: task.id,
        keyword: task.keyword,
        status: task.status_message,
        cost: task.cost,
        executionTime: task.execution_time
      },
      message: 'Task created successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles bulk CSV upload, batch partitioning and enqueuing
 */
async function uploadTasks(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('No CSV file uploaded', 400, 'BAD_REQUEST');
    }

    logger.info('Bulk task upload request received', { file: req.file.originalname });

    // 1. Parse CSV
    const parsedRows = await parseCsvFile(req.file.path);
    
    // Clean up uploaded temp file immediately
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error('Failed to delete temp file', { path: req.file.path, error: err.message });
    });

    if (parsedRows.length === 0) {
      throw new AppError('Uploaded CSV file is empty', 400, 'BAD_REQUEST');
    }

    // 2. Validate Rows
    const validationResult = validateCsvRows(parsedRows);
    const { totalRows, validRows, invalidRows, invalidDetails } = validationResult;

    // 3. Split valid rows into batches of max 100
    const batches = chunkArray(validRows, 100);
    const batchesMetadata = [];

    // 4. Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await taskService.createBulkTasks(batch);
      batchesMetadata.push({
        batchNumber: i + 1,
        size: batch.length
      });
    }

    res.status(200).json({
      success: true,
      data: {
        fileName: req.file.originalname,
        totalRows,
        validRows: validRows.length,
        invalidRows,
        invalidDetails,
        batches: batchesMetadata
      },
      message: 'CSV processed and queued in batches successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve tasks with query parameters
 */
async function getTasks(req, res, next) {
  try {
    logger.info('Task listing request received', { query: req.query });

    // 1. Validate query parameters
    validateGetTasksQuery(req.query);

    // 2. Destructure pagination, sorting and filter properties
    const {
      page,
      limit,
      offset,
      sortBy,
      sortOrder,
      keyword,
      status_code,
      status_message,
      priority,
      language_code,
      location_code,
      created_by,
      startDate,
      endDate
    } = req.query;

    const filters = {
      page: page !== undefined ? parseInt(page, 10) : undefined,
      limit: limit !== undefined ? parseInt(limit, 10) : undefined,
      offset: offset !== undefined ? parseInt(offset, 10) : undefined,
      sortBy,
      sortOrder,
      keyword,
      status_code: status_code !== undefined ? parseInt(status_code, 10) : undefined,
      status_message,
      priority: priority !== undefined ? parseInt(priority, 10) : undefined,
      language_code,
      location_code: location_code !== undefined ? parseInt(location_code, 10) : undefined,
      created_by,
      startDate,
      endDate
    };

    // 3. Retrieve tasks and metadata from service
    const result = await taskService.getTasks(filters);

    // 4. Return formatted response (backward compatible)
    res.status(200).json({
      success: true,
      message: 'Tasks retrieved successfully',
      data: result.tasks,
      pagination: result.pagination,
      filters: result.filters,
      sorting: result.sorting
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTask,
  uploadTasks,
  getTasks
};
