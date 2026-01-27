const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const createTestLog = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find an admin user to attribute the log to
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      console.log('No admin user found. Creating log with dummy ID (might fail populate).');
    }

    const testLog = new AuditLog({
      action: 'CREATE',
      targetType: 'Dorm',
      targetId: new mongoose.Types.ObjectId(),
      targetName: 'Test Dorm Entry',
      changes: {
        before: null,
        after: { name: 'Test Dorm', price: 5000 }
      },
      performedBy: admin ? admin._id : new mongoose.Types.ObjectId(),
      performedByName: admin ? admin.name : 'Test Script',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Script'
    });

    await testLog.save();
    console.log('Test Audit Log created successfully!');
    console.log('Log ID:', testLog._id);

  } catch (error) {
    console.error('Error creating test log:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
};

createTestLog();
