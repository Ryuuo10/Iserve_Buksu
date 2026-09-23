#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const Grievance = require('./models/Grievance');
const User = require('./models/User');
const OfficeCategory = require('./models/OfficeCategory');

async function testReassignmentDatabase() {
  try {
    console.log('\n🧪 TEST: Direct Database Reassignment\n');

    // Connect
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the unassigned grievance in COT Food Tech
    const grievance = await Grievance.findOne({
      office: 'COT - Food Technology Dept.',
      assignedTo: null
    }).select('_id referenceNumber office assignedTo __v');

    if (!grievance) {
      console.log('❌ No unassigned grievance found in COT Food Technology Dept.');
      process.exit(0);
    }

    console.log('📋 Target Grievance:');
    console.log(`   Reference: ${grievance.referenceNumber}`);
    console.log(`   Current assignedTo: ${grievance.assignedTo || 'null'}`);
    console.log(`   Version: ${grievance.__v}\n`);

    // Find first verified handler in COT Food Tech
    const handler = await User.findOne({
      office: 'cot_food_technology_dept',
      role: 'office_handler',
      isVerified: true
    }).select('_id name email');

    console.log('👤 Target Handler:');
    console.log(`   Name: ${handler.name}`);
    console.log(`   ID: ${handler._id}`);
    console.log(`   Email: ${handler.email}\n`);

    // TEST 1: Simple direct update (like the fallback)
    console.log('🔨 TEST 1: Simple findByIdAndUpdate()...');
    const updated1 = await Grievance.findByIdAndUpdate(
      grievance._id,
      {
        assignedTo: handler._id,
        assignedBy: handler._id,
        assignedAt: new Date(),
        status: 'in_progress'
      },
      { new: true }
    );

    console.log(`   ✓ assignedTo after: ${updated1.assignedTo || 'null'}`);
    console.log(`   ✓ status after: ${updated1.status}\n`);

    if (updated1.assignedTo?.toString() === handler._id.toString()) {
      console.log('✅ TEST 1 PASSED: Simple update works!\n');
    } else {
      console.log('❌ TEST 1 FAILED: Simple update did not save handler!\n');
    }

    // Reset for TEST 2
    await Grievance.findByIdAndUpdate(grievance._id, { assignedTo: null, status: 'under_review' });

    // TEST 2: Update with transaction
    console.log('🔨 TEST 2: Update with MongoDB transaction...');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updated2 = await Grievance.findByIdAndUpdate(
        grievance._id,
        {
          assignedTo: handler._id,
          assignedBy: handler._id,
          assignedAt: new Date(),
          status: 'in_progress'
        },
        { new: true, session }
      );

      await session.commitTransaction();
      console.log(`   ✓ assignedTo after: ${updated2.assignedTo || 'null'}`);
      console.log(`   ✓ status after: ${updated2.status}\n`);

      if (updated2.assignedTo?.toString() === handler._id.toString()) {
        console.log('✅ TEST 2 PASSED: Transaction update works!\n');
      } else {
        console.log('❌ TEST 2 FAILED: Transaction update did not save handler!\n');
      }
    } catch (err) {
      await session.abortTransaction();
      console.log(`❌ Transaction error: ${err.message}\n`);
    } finally {
      await session.endSession();
    }

    // Verify final state
    console.log('🔍 Final state in database:');
    const final = await Grievance.findById(grievance._id)
      .populate('assignedTo', 'name email');
    console.log(`   Reference: ${final.referenceNumber}`);
    console.log(`   Assigned To: ${final.assignedTo?.name || 'UNASSIGNED'}`);
    console.log(`   Status: ${final.status}\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Test error:', error.message);
    process.exit(1);
  }
}

testReassignmentDatabase();
