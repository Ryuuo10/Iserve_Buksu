const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: `${__dirname}/../.env` });

async function run() {
  try {
    const email = (process.env.SUPERADMIN_EMAIL || 'iservebuksu@gmail.com').toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!password) {
      throw new Error('SUPERADMIN_PASSWORD is required');
    }

    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const user = await User.findOne({ email });
    if (!user) {
      console.log('NOT_FOUND', email);
      await mongoose.disconnect();
      return;
    }

    const hashed = await bcrypt.hash(password, 10);

    user.password = hashed;
    user.googleId = `manual_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    user.isVerified = true;
    user.role = 'superadmin';
    user.status = 'active';
    await user.save();

    console.log('MANUAL_ENABLED', email, 'id:', user._id.toString());
    await mongoose.disconnect();
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
}

run();
