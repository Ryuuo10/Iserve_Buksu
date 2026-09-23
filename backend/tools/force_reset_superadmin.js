const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: `${__dirname}/../.env` });

async function run() {
  try {
    const email = (process.env.SUPERADMIN_EMAIL || 'iservebuksu@gmail.com').toLowerCase();
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const user = await User.findOne({ email });
    if (!user) {
      console.log('NOT_FOUND', email);
      await mongoose.disconnect();
      return;
    }

    user.password = null;
    await user.save();

    console.log('PASSWORD_CLEARED', email, user._id.toString());
    await mongoose.disconnect();
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
}

run();
