const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { csvUpload } = require('../middleware/uploadMiddleware');

/**
 * Task routes
 * Mounted on: /api/v1
 */

// GET /api/v1/tasks
router.get('/tasks', taskController.getTasks);

// POST /api/v1/tasks
router.post('/tasks', taskController.createTask);

// POST /api/v1/tasks/upload
router.post('/tasks/upload', csvUpload, taskController.uploadTasks);

module.exports = router;
