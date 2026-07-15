const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { validateTaskCreation } = require('../middleware/validationMiddleware');

/**
 * Task routes
 * Base path: /api/v1/tasks
 */

/**
 * POST /api/v1/tasks
 * Creates a new task
 */
router.post('/tasks', validateTaskCreation, taskController.createTask);

module.exports = router;
