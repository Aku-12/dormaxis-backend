const Dorm = require('../models/Dorm');
const Stats = require('../models/Stats');

// Get home page data (stats + popular dorms)
const getHomePageData = async (req, res) => {
  try {
    // Get or create stats
    let stats = await Stats.findOne();

    if (!stats) {
      // Create default stats if none exist
      const totalDorms = await Dorm.countDocuments();
      stats = await Stats.create({
        totalStudents: 200,
        totalDorms: totalDorms || 50,
        averageRating: 4.8
      });
    }

    // Get popular dorms
    const popularDorms = await Dorm.find({ isPopular: true, isAvailable: true })
      .limit(6)
      .select('-__v')
      .sort({ rating: -1 });

    res.json({
      success: true,
      data: {
        stats: {
          students: stats.totalStudents,
          dorms: stats.totalDorms,
          rating: stats.averageRating
        },
        popularDorms
      }
    });
  } catch (error) {
    console.error('Error fetching home page data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch home page data'
    });
  }
};

// Get statistics only
const getStats = async (req, res) => {
  try {
    let stats = await Stats.findOne();

    if (!stats) {
      const totalDorms = await Dorm.countDocuments();
      stats = await Stats.create({
        totalStudents: 200,
        totalDorms: totalDorms || 50,
        averageRating: 4.8
      });
    }

    res.json({
      success: true,
      data: {
        students: stats.totalStudents,
        dorms: stats.totalDorms,
        rating: stats.averageRating
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

// Get popular dorms
const getPopularDorms = async (req, res) => {
  try {
    const popularDorms = await Dorm.find({ isPopular: true, isAvailable: true })
      .limit(6)
      .select('-__v')
      .sort({ rating: -1 });

    res.json({
      success: true,
      data: popularDorms
    });
  } catch (error) {
    console.error('Error fetching popular dorms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular dorms'
    });
  }
};

module.exports = {
  getHomePageData,
  getStats,
  getPopularDorms
};
