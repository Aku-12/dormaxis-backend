const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auditLogController = require('../controllers/auditLogController');
const adminAuth = require('../middleware/adminAuth');
const { uploadDormImage } = require('../middleware/uploadMiddleware');

// Apply admin authentication middleware to all routes
router.use(adminAuth);

// Dashboard stats
router.get('/stats', adminController.getDashboardStats);

// Audit logs routes
router.get('/audit-logs', auditLogController.getAuditLogs);
router.get('/audit-logs/:id', auditLogController.getAuditLogById);

// Dorm management routes
router.get('/dorms', adminController.getAllDorms);
router.get('/dorms/:id', adminController.getDormById);
router.post('/dorms', adminController.createDorm);
router.put('/dorms/:id', adminController.updateDorm);
router.delete('/dorms/:id', adminController.deleteDorm);

// Dorm image upload (multiple)
router.post('/dorms/upload-image', uploadDormImage.array('images', 5), adminController.uploadDormImages);

// User management routes
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
