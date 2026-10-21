const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OfficeCategory = require('../models/OfficeCategory');
const { buildCategoryName, normalizeCatalogValue, slugifyCategoryName } = require('../utils/officeCategoryCatalog');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in backend/.env');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  // Demo credentials only. Do not overwrite an existing account.
  const email = 'col.office@example.com';
  const password = 'ColOffice2026!';
  const college = normalizeCatalogValue('College of Law (COL)');
  const name = buildCategoryName({ college, department: '' });
  const slug = slugifyCategoryName(name);
  let user = await User.findOne({ email });
  const alreadyExists = Boolean(user);
  if (user && (
    user.role !== 'office_handler' || user.office !== slug ||
    user.status !== 'active' || !user.isVerified ||
    !user.password || !await bcrypt.compare(password, user.password)
  )) {
    throw new Error(`Existing account ${email} differs from demo data; it was not changed.`);
  }

  const category = await OfficeCategory.findOneAndUpdate(
    { slug },
    { $setOnInsert: { college, department: '', name, slug, status: 'active' } },
    { upsert: true, new: true, runValidators: true }
  );
  if (category.status !== 'active') throw new Error('College of Law category is inactive; it was not changed.');

  if (!user) {
    user = await User.create({
      googleId: 'local_demo_col_office',
      name: 'COL College Office Test Handler',
      email,
      password: await bcrypt.hash(password, 10),
      role: 'office_handler',
      office: slug,
      isVerified: true,
      status: 'active',
    });
  }

  const saved = await User.findById(user._id);
  if (!saved || !await bcrypt.compare(password, saved.password) ||
    saved.office !== category.slug || saved.role !== 'office_handler' ||
    !saved.isVerified || saved.status !== 'active') {
    throw new Error(`Account verification failed for ${email}`);
  }
  console.table([{ office: college, email, password, result: alreadyExists ? 'Already exists; verified' : 'Created and verified' }]);
}

seed().catch((error) => {
  console.error('Law account seed failed:', error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
