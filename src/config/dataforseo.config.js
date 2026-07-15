module.exports = {
  BASE_URL: process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
  TIMEOUT: Number(process.env.DATAFORSEO_TIMEOUT || 30000),
  DEPTH: Number(process.env.DATAFORSEO_DEPTH || 10),
  MAX_SEO_POINTS_DEPTH: Number(process.env.DATAFORSEO_MAX_SEO_POINTS_DEPTH || 10)
};
