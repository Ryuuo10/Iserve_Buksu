const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OfficeCategory = require('../models/OfficeCategory');
const { buildCategoryName, normalizeCatalogValue, slugifyCategoryName } = require('../utils/officeCategoryCatalog');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Demo credentials only. Existing accounts are verified, never overwritten.
const accounts = [
  { key: 'automotive', department: 'Automotive Technology Department', password: 'CotAuto2026!' },
  { key: 'emc', department: 'EMC Department', password: 'CotEmc2026!' },
  { key: 'electronics', department: 'Electronics Technology Department', password: 'CotElectro2026!' },
  { key: 'food', department: 'Food Technology Department', password: 'CotFood2026!' },
  { key: 'it', department: 'Information Technology Department', password: 'CotInfo2026!' },
  { key: 'office', department: '', password: 'CotOffice2026!' },
];

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in backend/.env');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const college = normalizeCatalogValue('College of Technologies (COT)');
  const rows = [];
  for (const account of accounts) {
    const email = `cot.${account.key}@example.com`;
    const department = normalizeCatalogValue(account.department);
    const name = buildCategoryName({ college, department });
    const slug = slugifyCategoryName(name);
    const existingUser = await User.findOne({ email });
    if (existingUser && (
      existingUser.role !== 'office_handler' || existingUser.office !== slug ||
      existingUser.status !== 'active' || !existingUser.isVerified ||
      !existingUser.password || !await bcrypt.compare(account.password, existingUser.password)
    )) {
      throw new Error(`Existing account ${email} differs from demo data; it was not changed.`);
    }

    const category = await OfficeCategory.findOneAndUpdate(
      { slug },
      { $setOnInsert: { college, department, name, slug, status: 'active' } },
      { upsert: true, new: true, runValidators: true }
    );
    if (category.status !== 'active') throw new Error(`Office category ${slug} is inactive; it was not changed.`);

    let user = existingUser;
    if (!user) {
      user = await User.create({
        googleId: `local_demo_cot_${account.key}`,
        name: `COT ${account.department || 'College Office'} Test Handler`,
        email,
        password: await bcrypt.hash(account.password, 10),
        role: 'office_handler',
        office: slug,
        isVerified: true,
        status: 'active',
      });
    }

    // Read back the saved record and verify the same hash comparison used by login.
    const saved = await User.findById(user._id);
    if (!saved || !await bcrypt.compare(account.password, saved.password) ||
      saved.office !== category.slug || saved.role !== 'office_handler' ||
      !saved.isVerified || saved.status !== 'active') {
      throw new Error(`Account verification failed for ${email}`);
    }
    rows.push({ department: account.department || 'COT College Office', email, password: account.password, result: existingUser ? 'Already exists; verified' : 'Created and verified' });
  }
  console.table(rows);
}

seed().catch((error) => {
  console.error('COT account seed failed:', error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
