const express = require('express');
const router = express.Router();
const {
  getAllDorms,
  getFilterOptions,
  getDormById,
  createDorm,
  updateDorm,
  deleteDorm
} = require('../controllers/dormController');

// GET /api/dorms/filters - Get filter options (blocks, types, etc.)
router.get('/filters', getFilterOptions);

// GET /api/dorms - Get all dorms (with optional filters)
router.get('/', getAllDorms);

// GET /api/dorms/:id - Get single dorm
router.get('/:id', getDormById);

// POST /api/dorms - Create new dorm
router.post('/', createDorm);

// PUT /api/dorms/:id - Update dorm
router.put('/:id', updateDorm);

// DELETE /api/dorms/:id - Delete dorm
router.delete('/:id', deleteDorm);

module.exports = router;
