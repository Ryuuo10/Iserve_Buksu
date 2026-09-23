const User = require('../models/User');
const OfficeCategory = require('../models/OfficeCategory');
const { buildCategoryName, normalizeValue, slugifyCategoryName } = require('./officeCategoryCatalog');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Converts grievance office name to handler office slug
 * Uses both college and department when available so routing targets the exact office category.
 */
const getHandlerOfficeSlug = async (grievanceOrOffice, grievanceDepartment = '') => {
  const grievanceOffice =
    typeof grievanceOrOffice === 'object' && grievanceOrOffice !== null
      ? grievanceOrOffice.office
      : grievanceOrOffice;
  const department =
    typeof grievanceOrOffice === 'object' && grievanceOrOffice !== null
      ? grievanceOrOffice.department
      : grievanceDepartment;

  const normalizedOffice = normalizeValue(grievanceOffice);
  const normalizedDepartment = normalizeValue(department);

  if (!normalizedOffice) return null;
  
  try {
    if (normalizedDepartment) {
      const exactStructuredMatch = await OfficeCategory.findOne({
        college: { $regex: `^${escapeRegex(normalizedOffice)}$`, $options: 'i' },
        department: { $regex: `^${escapeRegex(normalizedDepartment)}$`, $options: 'i' },
        status: 'active',
      });

      if (exactStructuredMatch?.slug) {
        return exactStructuredMatch.slug;
      }
    }

    const compositeName = buildCategoryName({
      college: normalizedOffice,
      department: normalizedDepartment,
    });

    const officeCategory = await OfficeCategory.findOne({
      $or: [
        { slug: slugifyCategoryName(compositeName) },
        { name: { $regex: `^${escapeRegex(compositeName)}$`, $options: 'i' } },
        { name: { $regex: `^${escapeRegex(normalizedOffice)}$`, $options: 'i' } },
        { college: { $regex: `^${escapeRegex(normalizedOffice)}$`, $options: 'i' } },
      ],
      status: 'active',
    });
    
    return officeCategory?.slug || null;
  } catch (error) {
    console.error('Error converting office name to slug:', error);
    return null;
  }
};

/**
 * Finds available office handlers for a specific office
 * Returns handlers sorted by active grievance count (ascending)
 */
const findAvailableHandlers = async (officeSlug) => {
  if (!officeSlug) return [];
  
  try {
    // Find all office handlers with matching office
    const handlers = await User.find({
      role: 'office_handler',
      office: officeSlug,
      status: 'active',
      isVerified: true
    }).select('_id name email office status');

    if (handlers.length > 0) {
      return handlers;
    }

    const officeCategory = await OfficeCategory.findOne({ slug: officeSlug }).select('name college department slug');
    if (!officeCategory) {
      return [];
    }

    const normalizedCollege = normalizeValue(officeCategory.college);
    const normalizedDepartment = normalizeValue(officeCategory.department).replace(/\bdepartment\b/g, '').trim();
    const collegeAcronym = (officeCategory.college.match(/\(([A-Za-z]{2,6})\)/)?.[1] || '').toLowerCase();

    const fallbackHandlers = await User.find({
      role: 'office_handler',
      status: 'active',
      isVerified: true,
    }).select('_id name email office status');

    return fallbackHandlers.filter((handler) => {
      const normalizedHandlerOffice = normalizeValue(handler.office);
      if (!normalizedHandlerOffice) {
        return false;
      }

      const matchesCollege =
        !collegeAcronym ||
        normalizedHandlerOffice.includes(collegeAcronym) ||
        normalizedHandlerOffice.includes(normalizedCollege.replace(/\(.*?\)/g, '').trim());
      const matchesDepartment =
        !normalizedDepartment ||
        normalizedHandlerOffice.includes(normalizedDepartment);

      return matchesCollege && matchesDepartment;
    });
    
  } catch (error) {
    console.error('Error finding available handlers:', error);
    return [];
  }
};

/**
 * Auto-assigns a grievance to the best available handler
 * Uses round-robin or least-loaded logic
 */
const autoAssignGrievance = async (grievance, admin) => {
  try {
    // Step 1: Convert grievance office to handler office slug
    const officeSlug = await getHandlerOfficeSlug(grievance);
    
    if (!officeSlug) {
      console.warn(`⚠️  No office category found for grievance office: ${grievance.office} / ${grievance.department || 'No Department'}`);
      return null; // Could not auto-assign
    }
    
    // Step 2: Find available handlers
    const handlers = await findAvailableHandlers(officeSlug);
    
    if (handlers.length === 0) {
      console.warn(`⚠️  No available handlers found for office: ${officeSlug}`);
      return null; // No handlers available
    }
    
    // Step 3: Select handler (simple round-robin: pick first available)
    const selectedHandler = handlers[0];
    
    // Step 4: Return assignment data
    return {
      assignedTo: selectedHandler._id,
      assignedBy: admin?._id || null,
      assignedAt: new Date(),
      handlerName: selectedHandler.name,
      handlerEmail: selectedHandler.email,
    };
  } catch (error) {
    console.error('Auto-assignment error:', error);
    return null;
  }
};

/**
 * Attempts to auto-assign grievance after creation
 * Returns updated grievance if successful, null if auto-assignment failed
 */
const attemptAutoAssignment = async (grievance, Grievance) => {
  try {
    const assignmentData = await autoAssignGrievance(grievance, null);
    
    if (!assignmentData) {
      console.log(`ℹ️  Grievance ${grievance.referenceNumber} could not be auto-assigned (no handlers available)`);
      return null;
    }
    
    // Update grievance with assignment
    const updated = await Grievance.findByIdAndUpdate(
      grievance._id,
      {
        assignedTo: assignmentData.assignedTo,
        assignedBy: assignmentData.assignedBy,
        assignedAt: assignmentData.assignedAt,
        departmentAssignedAt: assignmentData.assignedAt,
        officeReceivedAt: assignmentData.assignedAt,
        status: 'assigned_to_department',
      },
      { new: true }
    ).populate('assignedTo', 'name email office');
    
    console.log(`✅ Grievance ${grievance.referenceNumber} auto-assigned to ${assignmentData.handlerName}`);
    return updated;
  } catch (error) {
    console.error('Error during auto-assignment:', error);
    return null;
  }
};

module.exports = {
  getHandlerOfficeSlug,
  findAvailableHandlers,
  autoAssignGrievance,
  attemptAutoAssignment,
};
