const OfficeCategory = require('../models/OfficeCategory');

const DEFAULT_ACADEMIC_OFFICE_CATEGORIES = [
  { college: 'College of Public Administration and Governance (CPAG)', department: 'Public Administration Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'Community Development Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'Development Communication Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'Economics Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'General Education Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'Language and Letters Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'Mathematics Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'Natural Sciences Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'Philosophy Department' },
  { college: 'College of Arts and Sciences (CAS)', department: 'Sociology & Social Sciences Department' },
  { college: 'College of Business (COB)', department: 'Accountancy Department' },
  { college: 'College of Business (COB)', department: 'Business Administration Department' },
  { college: 'College of Business (COB)', department: 'Hospitality Management Department' },
  { college: 'College of Education (COE)', department: 'Elementary School Laboratory (ESL) Department' },
  { college: 'College of Education (COE)', department: 'Secondary School Laboratory (SSL) Department' },
  { college: 'College of Education (COE)', department: 'Early Childhood Education Department' },
  { college: 'College of Education (COE)', department: 'Elementary Education Department' },
  { college: 'College of Education (COE)', department: 'Physical Education Department' },
  { college: 'College of Education (COE)', department: 'Secondary Education Department' },
  { college: 'College of Nursing (CON)', department: 'Nursing Department' },
  { college: 'College of Technologies (COT)', department: 'Automotive Technology Department' },
  { college: 'College of Technologies (COT)', department: 'EMC Department' },
  { college: 'College of Technologies (COT)', department: 'Electronics Technology Department' },
  { college: 'College of Technologies (COT)', department: 'Food Technology Department' },
  { college: 'College of Technologies (COT)', department: 'Information Technology Department' },
  { college: 'College of Law (COL)', department: '' },
];

const normalizeValue = (value = '') => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeCatalogValue = (value = '') => normalizeValue(value).toUpperCase();

const buildCategoryName = ({ college = '', department = '' }) => {
  const normalizedCollege = normalizeCatalogValue(college);
  const normalizedDepartment = normalizeCatalogValue(department);
  return normalizedDepartment ? `${normalizedCollege} ${normalizedDepartment}` : normalizedCollege;
};

const slugifyCategoryName = (value = '') =>
  normalizeValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

const getActiveOfficeCategories = async () =>
  OfficeCategory.find({ status: 'active' }).sort({ college: 1, department: 1, name: 1 });

const syncAcademicOfficeCategories = async () => {
  const operations = DEFAULT_ACADEMIC_OFFICE_CATEGORIES.map((entry) => {
    const college = normalizeCatalogValue(entry.college);
    const department = normalizeCatalogValue(entry.department);
    const name = buildCategoryName({ college, department });
    const slug = slugifyCategoryName(name);

    return {
      updateOne: {
        filter: { slug },
        update: {
          $set: {
            college,
            department,
            name,
            slug,
            status: 'active',
          },
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await OfficeCategory.bulkWrite(operations, { ordered: false });
  }
};

const buildOfficeCatalogPrompt = async () => {
  let categories = await getActiveOfficeCategories();

  if (categories.length === 0) {
    await syncAcademicOfficeCategories();
    categories = await getActiveOfficeCategories();
  }

  const groupedCatalog = new Map();

  categories.forEach((category) => {
    const college = normalizeCatalogValue(category.college || category.name);
    const department = normalizeCatalogValue(category.department);

    if (!groupedCatalog.has(college)) {
      groupedCatalog.set(college, []);
    }

    if (department) {
      groupedCatalog.get(college).push(department);
    }
  });

  const lines = ['Available routing catalog from the current office categories database:'];

  groupedCatalog.forEach((departments, college) => {
    lines.push(`- ${college}`);

    if (departments.length === 0) {
      lines.push('  - No department is required.');
      return;
    }

    departments.forEach((department) => {
      lines.push(`  - ${department}`);
    });
  });

  return lines.join('\n');
};

module.exports = {
  buildCategoryName,
  buildOfficeCatalogPrompt,
  getActiveOfficeCategories,
  normalizeCatalogValue,
  normalizeValue,
  slugifyCategoryName,
  syncAcademicOfficeCategories,
};
