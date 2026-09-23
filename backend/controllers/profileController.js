const User = require('../models/User');
const OfficeCategory = require('../models/OfficeCategory');
const { formatConflictResponse } = require('../utils/concurrencyUtils');

// Get user profile completion status
const getProfileCompletionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const missingFields = [];

    if (user.role === 'office_handler' && !user.office) {
      missingFields.push('office');
    }

    if (user.role === 'complainant' && !user.complainantType) {
      missingFields.push('complainantType');
    }

    const needsCompletion = missingFields.length > 0;
    
    return res.status(200).json({
      success: true,
      needsCompletion,
      role: user.role,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        office: user.office,
        complainantType: user.complainantType,
      },
      completedFields: {
        name: !!user.name,
        email: !!user.email,
        office: user.role === 'office_handler' ? !!user.office : true,
        complainantType: user.role === 'complainant' ? !!user.complainantType : true,
      },
      missingFields
    });
  } catch (error) {
    console.error('Profile completion status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking profile completion status'
    });
  }
};

// Complete user profile
const completeUserProfile = async (req, res) => {
  try {
    const { office, complainantType, version } = req.body;
    const userId = req.user._id;
    
    // Validate required fields based on user role
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check version conflict if provided
    if (version !== undefined && user.__v !== version) {
      return res.status(409).json(
        formatConflictResponse(user, { office })
      );
    }

    // Only office handlers need office field
    if (user.role === 'office_handler') {
      if (!office) {
        return res.status(400).json({
          success: false,
          message: 'Office/Department is required for office handlers'
        });
      }

      // Validate office against dynamic categories from database
      const validCategory = await OfficeCategory.findOne({
        $or: [{ slug: office }, { name: office }],
        status: 'active'
      });

      if (!validCategory) {
        return res.status(400).json({
          success: false,
          message: 'Invalid office selection'
        });
      }

      // Update user profile
      user.office = office;
    }

    if (user.role === 'complainant') {
      if (!['student', 'staff', 'parent'].includes(complainantType)) {
        return res.status(400).json({
          success: false,
          message: 'Complainant type is required for complainants'
        });
      }

      user.complainantType = complainantType;
    }

    // Mark profile as completed
    user.profileCompleted = true;
    user.updatedAt = new Date();
    
    const updated = await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile completed successfully',
      user: {
        id: updated._id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        office: updated.office,
        complainantType: updated.complainantType,
        profileCompleted: updated.profileCompleted,
        version: updated.__v
      }
    });
  } catch (error) {
    console.error('Profile completion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error completing profile'
    });
  }
};

// Get available offices for dropdown (dynamic from OfficeCategory collection)
const getAvailableOffices = async (req, res) => {
  try {
    const categories = await OfficeCategory.find({ status: 'active' }).sort({ name: 1 });

    const offices = categories.map(cat => ({
      id: cat.slug,
      name: cat.name,
      college: cat.college || '',
      department: cat.department || '',
    }));

    return res.status(200).json({
      success: true,
      offices
    });
  } catch (error) {
    console.error('Get offices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving offices'
    });
  }
};

module.exports = {
  getProfileCompletionStatus,
  completeUserProfile,
  getAvailableOffices
};
