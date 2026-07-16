const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

class DataForSeoService {
  constructor() {
    this.username = process.env.DATAFORSEO_USERNAME;
    this.password = process.env.DATAFORSEO_PASSWORD;
    this.baseUrl = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
  }

  /**
   * Helper to check if credentials are configured
   */
  isConfigured() {
    return (
      this.username &&
      this.username !== 'your_dataforseo_email' &&
      this.password &&
      this.password !== 'your_dataforseo_api_key'
    );
  }

  /**
   * Fetch SERP data for a single or multiple tasks
   * @param {Array<Object>} tasks - Array of task parameters
   * @returns {Promise<Object>} DataForSEO Response object
   */
  async fetchSERPData(tasks) {
    if (!Array.isArray(tasks)) {
      tasks = [tasks];
    }

    const payload = tasks.map(task => ({
      keyword: task.keyword,
      language_code: task.language_code || 'en',
      location_code: parseInt(task.location_code || 2840, 10),
      priority: parseInt(task.priority || 1, 10)
    }));

    if (!this.isConfigured()) {
      logger.warn('DataForSEO credentials not configured or using placeholders. Falling back to MOCK responses.');
      return this.generateMockResponse(payload);
    }

    try {
      logger.info('Calling DataForSEO API...', { taskCount: payload.length });
      
      const authHeader = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10s timeout
      });

      const data = response.data;
      
      if (data.status_code !== 20000) {
        throw new Error(`DataForSEO API error: ${data.status_message} (Code: ${data.status_code})`);
      }

      logger.info('DataForSEO API call successful', { time: data.time, cost: data.cost });
      return data;
    } catch (error) {
      logger.error('DataForSEO API request failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generates mock response matching DataForSEO response structure
   */
  async generateMockResponse(payload) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const tasks = payload.map((task, idx) => {
      const mockTaskId = `mock-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
      return {
        id: mockTaskId,
        status_code: 20000,
        status_message: 'Ok.',
        time: '0.1250 sec',
        cost: 0.003,
        result_count: 1,
        result: [
          {
            keyword: task.keyword,
            type: 'organic',
            items_count: 3,
            items: [
              {
                type: 'organic',
                rank_group: 1,
                rank_absolute: 1,
                domain: 'example.com',
                title: `Best ${task.keyword} Guides 2026`,
                description: `Read about top options for ${task.keyword} and learning tutorials.`
              },
              {
                type: 'organic',
                rank_group: 2,
                rank_absolute: 2,
                domain: 'wikipedia.org',
                title: task.keyword,
                description: `${task.keyword} explanation, history, concepts and resources.`
              },
              {
                type: 'related_searches',
                rank_group: 1,
                rank_absolute: 3,
                items: [
                  `${task.keyword} jobs`,
                  `${task.keyword} salary`,
                  `${task.keyword} tutorials`
                ]
              }
            ]
          }
        ]
      };
    });

    return {
      version: '0.1.mock',
      status_code: 20000,
      status_message: 'Ok.',
      time: '0.5000 sec',
      cost: 0.003 * payload.length,
      tasks_count: payload.length,
      tasks_error: 0,
      tasks
    };
  }
}

module.exports = new DataForSeoService();
