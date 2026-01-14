const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
  totalStudents: {
    type: Number,
    default: 0
  },
  totalDorms: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Stats', statsSchema);
