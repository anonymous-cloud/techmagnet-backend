const axios = require('axios');
const logger = require('../utils/logger');
const dataforseoConfig = require('../config/dataforseo.config');

// Create Axios instance with configuration
const client = axios.create({
  baseURL: dataforseoConfig.BASE_URL,
  timeout: dataforseoConfig.TIMEOUT
});

const fetchSERPData = async (keyword, locationCode, languageCode, priority) => {
  const startTime = Date.now();

  try {
    // Generate Basic Auth dynamically
    const auth = Buffer.from(
      `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
    ).toString('base64');

    const requestData = [
      {
        keyword: keyword,
        location_code: locationCode,
        language_code: languageCode,
        priority: priority,
        depth: dataforseoConfig.DEPTH,
        max_seo_points_depth: dataforseoConfig.MAX_SEO_POINTS_DEPTH
      }
    ];

    logger.info('DataForSEO API request started', {
      keyword,
      locationCode,
      languageCode,
      priority
    });

    const response = await client.post('', requestData, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;

    logger.info('DataForSEO API request completed', {
      statusCode: response.status,
      responseTime: `${responseTime}ms`,
      keyword
    });

    // Validate response structure
    if (!response.data || !response.data.tasks || !Array.isArray(response.data.tasks)) {
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'Invalid response format from DataForSEO: missing tasks array'
        }
      };
    }

    if (response.data.tasks.length === 0) {
      return {
        success: false,
        error: {
          code: 'EMPTY_TASKS',
          message: 'DataForSEO returned empty tasks array'
        }
      };
    }

    // Explicit field mapping from tasks[0]
    const task = response.data.tasks[0];
    console.log(JSON.stringify(task, null, 2));

    return {
      success: true,
      data: {
        task_id: task.id,                           // tasks[0].id
        status_code: task.status_code,              // tasks[0].status_code
        status_message: task.status_message,        // tasks[0].status_message
        cost: task.cost,                            // tasks[0].cost
        execution_time: task.time,                  // tasks[0].time
        keyword: keyword,
        location_code: locationCode,
        language_code: languageCode,
        priority: priority
      }
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('DataForSEO API request failed', {
      error: error.message,
      responseTime: `${responseTime}ms`,
      keyword
    });

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'DataForSEO API request timeout'
        }
      };
    }

    if (error.response) {
      const statusCode = error.response.status;
      const errorMessage = error.response.data?.message || 'Unknown API error';

      if (statusCode === 401 || statusCode === 403) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Invalid DataForSEO credentials'
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: `DataForSEO API error: ${errorMessage}`
        }
      };
    }

    if (error.request) {
      return {
        success: false,
        error: {
          code: 'NO_RESPONSE',
          message: 'No response from DataForSEO API'
        }
      };
    }

    return {
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: `DataForSEO service error: ${error.message}`
      }
    };
  }
};

module.exports = { fetchSERPData };
