const User = require('../models/User');
const OfficeCategory = require('../models/OfficeCategory');
const Grievance = require('../models/Grievance');
const { transporter } = require('../utils/emailUtils');
const {
  notifyOfficeHandlerOfficeUpdated,
  notifyOfficeHandlerVerified,
} = require('../services/notificationService');
const {
  updateWithLockAndTransaction,
  formatConflictResponse,
} = require('../utils/concurrencyUtils');

const OFFICE_ACRONYM_MAP = {
  cot: 'COT',
  coe: 'COE',
  con: 'CON',
  cob: 'COB',
  cpag: 'CPAG',
  cas: 'CAS',
  col: 'COL',
  esl: 'ESL',
  ssl: 'SSL',
  it: 'IT',
  cr: 'CR',
};

const normalizeCategoryName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const formatCategorySegment = (value) =>
  normalizeCategoryName(value).toUpperCase();
const slugifyCategoryName = (value) =>
  normalizeCategoryName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildCategoryPayload = (payload = {}, existingCategory = null) => {
  const hasStructuredInput =
    payload?.college !== undefined || payload?.department !== undefined;

  if (hasStructuredInput) {
    const college = formatCategorySegment(payload?.college);
    const department = formatCategorySegment(payload?.department);

    if (!college) {
      return {
        valid: false,
        message: 'College is required',
      };
    }

    const name = department
      ? normalizeCategoryName(`${college} ${department}`)
      : normalizeCategoryName(college);
    return {
      valid: true,
      college,
      department,
      name,
      slug: slugifyCategoryName(name),
    };
  }

  const name = formatCategorySegment(payload?.name);
  if (!name) {
    return {
      valid: false,
      message: 'A valid office category name is required',
    };
  }

  return {
    valid: true,
    college: existingCategory?.college || '',
    department: existingCategory?.department || '',
    name,
    slug: slugifyCategoryName(name),
  };
};
const buildOfficeReferenceQuery = (value) => {
  const normalized = normalizeCategoryName(value);

  if (!normalized) {
    return { office: '__never_match__' };
  }

  return {
    $or: [
      { office: normalized },
      { office: slugifyCategoryName(normalized) },
      { office: { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' } },
    ],
  };
};

// Get all office handler users grouped by verification status
const getOfficeHandlers = async (req, res) => {
  try {
    const officeHandlers = await User.find({ role: 'office_handler', status: { $ne: 'blocked' } })
      .select('name email office isVerified status createdAt lastLogin profilePicture')
      .sort({ createdAt: -1 });

    const pending = officeHandlers.filter(u => !u.isVerified);
    const verified = officeHandlers.filter(u => u.isVerified);

    return res.status(200).json({
      success: true,
      pending,
      verified,
    });
  } catch (error) {
    console.error('Get Office Handlers Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving office handlers',
    });
  }
};

// Verify an office handler account and send approval email
const verifyOfficeHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user || user.role !== 'office_handler') {
      return res.status(404).json({
        success: false,
        message: 'Office handler not found',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Office handler is already verified',
      });
    }

    user.isVerified = true;
    await user.save();

    await notifyOfficeHandlerVerified({
      user,
      actor: req.user,
    });

    // Send verification approval email
    try {
      const officeName = user.office
        ? user.office.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : 'N/A';

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Account Verified - iServe BukSU Grievance System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Account Verified ✓</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px;">Hello <strong>${user.name}</strong>,</p>
              <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                Your office handler account has been <strong style="color: #059669;">approved and verified</strong> by the administrator. You can now log in and start managing complaints for your assigned office.
              </p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;"><strong>Account Details:</strong></p>
                <p style="margin: 4px 0; color: #4b5563; font-size: 13px;">📧 Email: ${user.email}</p>
                <p style="margin: 4px 0; color: #4b5563; font-size: 13px;">🏢 Office: ${officeName}</p>
                <p style="margin: 4px 0; color: #4b5563; font-size: 13px;">✅ Status: Verified</p>
              </div>
              <p style="color: #6b7280; font-size: 13px;">You can now log in using your registered credentials.</p>
            </div>
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">This is an automated message from the iServe BukSU Grievance System.</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    return res.status(200).json({
      success: true,
      message: `${user.name} has been verified successfully`,
    });
  } catch (error) {
    console.error('Verify Office Handler Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying office handler',
    });
  }
};

// Reject (delete) a pending office handler account with reason and email
const rejectOfficeHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'office_handler') {
      return res.status(404).json({
        success: false,
        message: 'Office handler not found',
      });
    }

    const userName = user.name;
    const userEmail = user.email;
    const userOffice = user.office
      ? user.office.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'N/A';

    await User.findByIdAndDelete(userId);

    // Send rejection email with reason
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Account Application Rejected - iServe BukSU Grievance System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Application Rejected</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
              <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                We regret to inform you that your office handler account application has been <strong style="color: #dc2626;">rejected</strong> by the administrator.
              </p>
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;"><strong>Reason for Rejection:</strong></p>
                <p style="margin: 0; color: #991b1b; font-size: 14px; font-style: italic;">${reason || 'No reason provided.'}</p>
              </div>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;"><strong>Application Details:</strong></p>
                <p style="margin: 4px 0; color: #4b5563; font-size: 13px;">📧 Email: ${userEmail}</p>
                <p style="margin: 4px 0; color: #4b5563; font-size: 13px;">🏢 Office Applied: ${userOffice}</p>
              </div>
              <p style="color: #6b7280; font-size: 13px;">If you believe this was a mistake, please contact the system administrator.</p>
            </div>
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">This is an automated message from the iServe BukSU Grievance System.</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
    }

    return res.status(200).json({
      success: true,
      message: `${userName} has been rejected and removed`,
    });
  } catch (error) {
    console.error('Reject Office Handler Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error rejecting office handler',
    });
  }
};

// Get all office categories
const getOfficeCategories = async (req, res) => {
  try {
    const categories = await OfficeCategory.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('Get Office Categories Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving office categories',
    });
  }
};

// Create a new office category
const createOfficeCategory = async (req, res) => {
  try {
    const payload = buildCategoryPayload(req.body);

    if (!payload.valid) {
      return res.status(400).json({
        success: false,
        message: payload.message,
      });
    }

    const { college, department, name, slug } = payload;

    const existingCategory = await OfficeCategory.findOne({
      $or: [
        { slug },
        { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
      ],
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: 'An office category with this name already exists',
      });
    }

    const category = await OfficeCategory.create({
      college,
      department,
      name,
      slug,
    });

    return res.status(201).json({
      success: true,
      message: 'Office category created successfully',
      category,
    });
  } catch (error) {
    console.error('Create Office Category Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating office category',
    });
  }
};

// Update an office category and propagate slug changes
const updateOfficeCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { version } = req.body;

    const category = await OfficeCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Office category not found',
      });
    }

    const payload = buildCategoryPayload(req.body, category);
    if (!payload.valid) {
      return res.status(400).json({
        success: false,
        message: payload.message,
      });
    }

    const { college, department, name, slug } = payload;

    // Check for conflicts if version provided
    if (version !== undefined && category.__v !== version) {
      return res.status(409).json(
        formatConflictResponse(category, { college, department, name, slug })
      );
    }

    const duplicateCategory = await OfficeCategory.findOne({
      _id: { $ne: categoryId },
      $or: [
        { slug },
        { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
      ],
    });

    if (duplicateCategory) {
      return res.status(409).json({
        success: false,
        message: 'An office category with this name already exists',
      });
    }

    // Use transaction for atomic update of office category + cascading updates
    const result = await updateWithLockAndTransaction(
      OfficeCategory,
      categoryId,
      async (doc, session) => {
        const previousSlug = doc.slug;
        const previousName = doc.name;
        
        // Update office category
        const updated = await OfficeCategory.findByIdAndUpdate(
          categoryId,
          { college, department, name, slug },
          { new: true, session, runValidators: true }
        );

        // If slug or name changed, cascade updates to User and Grievance
        if (previousSlug !== slug || previousName !== name) {
          const previousOfficeRefs = {
            $or: [
              ...buildOfficeReferenceQuery(previousName).$or,
              ...buildOfficeReferenceQuery(previousSlug).$or,
            ],
          };

          await Promise.all([
            User.updateMany(previousOfficeRefs, { $set: { office: slug } }, { session }),
            Grievance.updateMany(previousOfficeRefs, { $set: { office: slug } }, { session }),
          ]);
        }

        return updated;
      },
      version
    );

    if (!result.success) {
      if (result.conflict) {
        return res.status(result.statusCode).json(
          formatConflictResponse(category, { college, department, name, slug })
        );
      }
      return res.status(result.statusCode).json({ success: false, message: result.error });
    }

    return res.status(200).json({
      success: true,
      message: 'Office category updated successfully',
      category: result.data,
    });
  } catch (error) {
    console.error('Update Office Category Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating office category',
    });
  }
};

// Delete an office category if it is no longer in use
const deleteOfficeCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await OfficeCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Office category not found',
      });
    }

    const officeReferenceQuery = buildOfficeReferenceQuery(category.name);

    const [assignedHandlers, relatedGrievances] = await Promise.all([
      User.countDocuments({
        role: 'office_handler',
        status: { $ne: 'blocked' },
        ...officeReferenceQuery,
      }),
      Grievance.countDocuments({
        archived: { $ne: true },
        ...officeReferenceQuery,
      }),
    ]);

    if (assignedHandlers > 0 || relatedGrievances > 0) {
      return res.status(400).json({
        success: false,
        message: 'This category is still assigned to office handlers or grievances',
      });
    }

    await OfficeCategory.findByIdAndDelete(categoryId);

    return res.status(200).json({
      success: true,
      message: 'Office category deleted successfully',
    });
  } catch (error) {
    console.error('Delete Office Category Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting office category',
    });
  }
};

// Update a verified office handler's category
const updateOfficeHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { office, version } = req.body;

    if (!office) {
      return res.status(400).json({
        success: false,
        message: 'Office category is required',
      });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'office_handler') {
      return res.status(404).json({
        success: false,
        message: 'Office handler not found',
      });
    }

    // Check for version conflict if provided
    if (version !== undefined && user.__v !== version) {
      return res.status(409).json(
        formatConflictResponse(user, { office })
      );
    }

    const previousOffice = user.office || null;
    user.office = office;
    
    // Save with version check (Mongoose increments __v automatically)
    const updated = await user.save();

    await notifyOfficeHandlerOfficeUpdated({
      user: updated,
      actor: req.user,
      previousOffice,
      nextOffice: updated.office,
    });

    return res.status(200).json({
      success: true,
      message: `${updated.name}'s office category updated successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Update Office Handler Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating office handler',
    });
  }
};

// Delete a verified office handler account (soft-delete)
const deleteOfficeHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user || user.role !== 'office_handler') {
      return res.status(404).json({
        success: false,
        message: 'Office handler not found',
      });
    }

    const userName = user.name;
    user.status = 'blocked';
    user.isVerified = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `${userName}'s account has been deleted and blocked from logging in`,
    });
  } catch (error) {
    console.error('Delete Office Handler Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting office handler',
    });
  }
};

module.exports = {
  getOfficeHandlers,
  verifyOfficeHandler,
  rejectOfficeHandler,
  getOfficeCategories,
  createOfficeCategory,
  updateOfficeCategory,
  deleteOfficeCategory,
  updateOfficeHandler,
  deleteOfficeHandler,
};
