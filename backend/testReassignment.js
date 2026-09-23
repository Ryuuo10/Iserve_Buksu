#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const Grievance = require('./models/Grievance');
const User = require('./models/User');
const OfficeCategory = require('./models/OfficeCategory');

const API_BASE = 'http://localhost:5004/api';

async function testReassignment() {
  try {
    console.log('\n🔍 TEST: Grievance Reassignment\n');

    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find an admin token by checking admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('❌ No admin user found');
      process.exit(1);
    }
    console.log(`✅ Found admin: ${admin.name}`);

    // Get list of offices and handlers
    const offices = await OfficeCategory.find({}).select('name slug');
    const firstOffice = offices[0];
    const secondOffice = offices[1] || offices[0];
    console.log(`\n📍 Offices found:`);
    console.log(`   From: ${firstOffice.name} (slug: ${firstOffice.slug})`);
    console.log(`   To: ${secondOffice.name} (slug: ${secondOffice.slug})`);

    const firstOfficeHandlers = await User.find({
      role: 'office_handler',
      office: firstOffice.slug,
      status: 'active',
      isVerified: true
    }).select('name email');

    const secondOfficeHandlers = await User.find({
      role: 'office_handler',
      office: secondOffice.slug,
      status: 'active',
      isVerified: true
    }).select('name email');

    console.log(`\n👤 Handlers:`);
    console.log(`   In "${firstOffice.name}": ${firstOfficeHandlers.length} handler(s)`);
    firstOfficeHandlers.forEach(h => console.log(`      - ${h.name} (${h.email})`));
    console.log(`   In "${secondOffice.name}": ${secondOfficeHandlers.length} handler(s)`);
    secondOfficeHandlers.forEach(h => console.log(`      - ${h.name} (${h.email})`));

    // Find a grievance in the first office
    const grievance = await Grievance.findOne({ office: firstOffice.name })
      .populate('assignedTo', 'name email office')
      .select('referenceNumber office assignedTo __v');

    if (!grievance) {
      console.log(`\n⚠️  No grievances found in "${firstOffice.name}" office`);
      process.exit(0);
    }

    console.log(`\n📋 Test grievance:`);
    console.log(`   Reference: ${grievance.referenceNumber}`);
    console.log(`   Current office: ${grievance.office}`);
    console.log(`   Current handler: ${grievance.assignedTo?.name || 'Unassigned'}`);
    console.log(`   Version: ${grievance.__v}`);

    // Try reassigning using the endpoint
    console.log(`\n🔄 Testing reassignment to "${secondOffice.name}"...`);

    // For this test, we'll use a simple jwt token - in real scenario an admin would have this
    const testToken = 'test-token-for-demo';

    try {
      const response = await axios.put(
        `${API_BASE}/admin/grievances/${grievance._id}/reassign-office`,
        {
          newOffice: secondOffice.name,
          reassignReason: 'Testing reassignment endpoint',
          version: grievance.__v
        },
        {
          headers: { Authorization: `Bearer ${testToken}` }
        }
      );
      console.log('\n✅ Reassignment request successful');
      console.log(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('\n⚠️  Auth required (expected - need valid JWT token)');
        console.log(`    Endpoint would be: PUT ${API_BASE}/admin/grievances/${grievance._id}/reassign-office`);
        console.log(`    Request body:`);
        console.log(JSON.stringify({
          newOffice: secondOffice.name,
          reassignReason: 'Testing reassignment endpoint',
          version: grievance.__v
        }, null, 2));
      } else {
        console.error('\n❌ Request failed:', err.response?.data || err.message);
      }
    }

    // Check database state records
    console.log(`\n📊 Database state check:`);
    const updatedGrievance = await Grievance.findById(grievance._id)
      .populate('assignedTo', 'name email office');

    console.log(`   Office after change: ${updatedGrievance.office}`);
    console.log(`   Handler after change: ${updatedGrievance.assignedTo?.name || 'Unassigned'}`);

    mongoose.disconnect();
    console.log('\n✅ Test complete\n');
  } catch (error) {
    console.error('Test error:', error.message);
    process.exit(1);
  }
}

testReassignment();
