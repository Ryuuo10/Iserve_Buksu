const mongoose = require('mongoose');
const User = require('../backend/models/User');
require('dotenv').config({ path: './backend/.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('NO_ADMIN');
    } else {
      console.log('FOUND_ADMIN');
      console.log('email:', admin.email);
      console.log('password:', admin.password);
      console.log('createdAt:', admin.createdAt);
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
}

run();
