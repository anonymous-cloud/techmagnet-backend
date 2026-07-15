const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { validateTaskCreation } = require('../middleware/validationMiddleware');
const { csvUpload } = require('../middleware/uploadMiddleware');

/**
 * Task routes
 * Base path: /api/v1/tasks
 */

/**
 * POST /api/v1/tasks
 * Creates a new task
 */
router.post('/tasks', validateTaskCreation, taskController.createTask);

/**
 * POST /api/v1/tasks/upload
 * Uploads a CSV of tasks
 */
router.post('/tasks/upload', csvUpload, taskController.uploadTasks);

module.exports = router;
