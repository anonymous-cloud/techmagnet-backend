const { createTask } = require('../services/taskService');
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
       console.log(req.body,"ooooo");
      logger.info('Task creation request received', { keyword });

      const result = await createTask({ keyword, language, location, priority });
       console.log(result,"pppppp")
      // res.status(201).json({
      //   success: true,
      //   data: result,
      //   message: 'Task created successfully'
      // });
      // Step 6: Return business object
    // return toBusinessObject(createdTask);
        res.status(201).json({
      success: result.status === 'success',
      data: result,
      message: result.status === 'success'
        ? 'Task created successfully'
        : 'Task created but processing failed'
    });


    } catch (error) {
      // Forward error to global error handler
      next(error);
    }
  }
};

module.exports = taskController;
