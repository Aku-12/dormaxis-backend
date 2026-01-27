const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const checkLogs = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const count = await AuditLog.countDocuments();
    console.log(`Total Audit Logs: ${count}`);

    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('performedBy', 'name role');

    console.log('Recent 5 Logs:');
    logs.forEach(log => {
      console.log(`[${log.createdAt.toISOString()}] ${log.action} ${log.targetType} - ${log.targetName} (By: ${log.performedBy ? log.performedBy.name : 'Unknown'})`);
    });

  } catch (error) {
    console.error('Error checking logs:', error);
  } finally {
    await mongoose.disconnect();
  }
};

checkLogs();
