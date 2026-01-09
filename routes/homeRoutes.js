const express = require('express');
const router = express.Router();
const {
  getHomePageData,
  getStats,
  getPopularDorms
} = require('../controllers/homeController');

// GET /api/home - Get all home page data
router.get('/', getHomePageData);

// GET /api/home/stats - Get statistics only
router.get('/stats', getStats);

// GET /api/home/popular - Get popular dorms only
router.get('/popular', getPopularDorms);

module.exports = router;
