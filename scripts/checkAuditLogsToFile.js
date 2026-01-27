const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const path = require('path');
const fs = require('fs');
// Try to load .env from parent directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const checkLogs = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dormaxis';
    await mongoose.connect(MONGO_URI);
    
    const count = await AuditLog.countDocuments();
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('performedBy', 'name role');

    let output = `Total Audit Logs: ${count}\n\nRecent 5 Logs:\n`;
    logs.forEach(log => {
      output += `[${log.createdAt.toISOString()}] ${log.action} ${log.targetType} - ${log.targetName} (By: ${log.performedBy ? log.performedBy.name : 'Unknown'})\n`;
    });

    fs.writeFileSync('audit_logs_dump.txt', output);
    console.log('Logs dumped to audit_logs_dump.txt');

  } catch (error) {
    fs.writeFileSync('audit_logs_dump.txt', `Error: ${error.message}`);
  } finally {
    await mongoose.disconnect();
  }
};

checkLogs();
