const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dormaxis';

const run = async () => {
  try {
    console.log('Connecting to:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const admin = await User.findOne({ role: 'admin' });
    const userId = admin ? admin._id : new mongoose.Types.ObjectId();
    const userName = admin ? admin.name : 'System Script';

    console.log(`Creating log as user: ${userName} (${userId})`);

    const log = new AuditLog({
      action: 'CREATE',
      targetType: 'Dorm',
      targetId: new mongoose.Types.ObjectId(),
      targetName: 'Debug Log Test',
      changes: { after: { test: true } },
      performedBy: userId,
      performedByName: userName,
      ipAddress: '127.0.0.1',
      userAgent: 'Script'
    });

    const savedLog = await log.save();
    console.log('Log saved successfully! ID:', savedLog._id);

    // Verify
    const count = await AuditLog.countDocuments();
    console.log('Total Logs in DB:', count);

  } catch (error) {
    console.error('FAILED:', error);
  } finally {
    await mongoose.disconnect();
  }
};

run();
