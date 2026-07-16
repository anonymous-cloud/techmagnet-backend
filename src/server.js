const express = require('express');
const { testConnection } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { AppError } = require('./errors');
const logger = require('./utils/logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_PREFIX = '/api/v1';

// Middleware
app.use(express.json());

// Routes
const taskRoutes = require('./routes/taskRoutes');
app.use(API_PREFIX, taskRoutes);

// Health check route
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      server: 'running'
    }
  });
});

// 404 handler
app.use((req, res, next) => {
  next(new AppError('Route not found', 404, 'NOT_FOUND'));
});

// Global error handler (must be after all routes)
app.use(errorHandler);

// Test DB connection before starting server
async function startServer() {
  try {
    await testConnection();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer();
