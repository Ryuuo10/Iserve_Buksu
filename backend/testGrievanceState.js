#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');

const Grievance = require('./models/Grievance');
const User = require('./models/User');
const OfficeCategory = require('./models/OfficeCategory');

async function diagnoseGrievances() {
  try {
    console.log('\n🔍 DIAGNOSTIC: Grievance Assignment State\n');

    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Find COT Food Tech office
    const cotOffice = await OfficeCategory.findOne({
      name: { $regex: 'Food Technology', $options: 'i' }
    }).select('name slug');

    console.log('📍 COT Food Tech Office:');
    console.log(`   Name: ${cotOffice?.name}`);
    console.log(`   Slug: ${cotOffice?.slug}\n`);

    // 2. Find all handlers in COT Food Tech
    const handlers = await User.find({
      role: 'office_handler',
      office: cotOffice?.slug,
      status: 'active'
    }).select('_id name email isVerified');

    console.log(`👤 Handlers in ${cotOffice?.name}:`);
    handlers.forEach((h, i) => {
      console.log(`   ${i + 1}. ${h.name} (${h.email})`);
      console.log(`      ID: ${h._id}`);
      console.log(`      Verified: ${h.isVerified ? '✅' : '❌'}`);
    });

    if (handlers.length === 0) {
      console.log('   ⚠️  NO HANDLERS FOUND!');
    }

    // 3. Find all grievances assigned to this office
    console.log(`\n📋 Grievances by Office:\n`);

    // Group grievances by office
    const allGrievances = await Grievance.aggregate([
      {
        $group: {
          _id: '$office',
          count: { $sum: 1 },
          examples: { $push: { ref: '$referenceNumber', assigned: '$assignedTo' } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    allGrievances.forEach(group => {
      console.log(`${group._id}: ${group.count} grievances`);
      group.examples.slice(0, 3).forEach(ex => {
        console.log(`   - ${ex.ref} → handler: ${ex.assigned ? ex.assigned.toString().slice(-8) : 'NOT ASSIGNED'}`);
      });
    });

    // 4. Find grievances in COT Food Tech office specifically
    console.log(`\n🎯 Focus: Grievances in "${cotOffice?.name}":\n`);

    const cotGrievances = await Grievance.find({
      office: cotOffice?.name
    }).populate('assignedTo', 'name email _id').select('referenceNumber office assignedTo status');

    if (cotGrievances.length === 0) {
      console.log(`   ⚠️  NO GRIEVANCES found with office = "${cotOffice?.name}"`);
    } else {
      cotGrievances.forEach(g => {
        console.log(`   ${g.referenceNumber}:`);
        console.log(`      Office: ${g.office}`);
        console.log(`      Assigned To: ${g.assignedTo ? g.assignedTo.name + ` (${g.assignedTo._id})` : 'UNASSIGNED'}`);
        console.log(`      Status: ${g.status}`);
      });
    }

    // 5. Check what each handler SHOULD see (direct query)
    console.log(`\n🔎 What each handler sees (query: assignedTo = handler._id):\n`);

    for (const handler of handlers) {
      const grievancesForHandler = await Grievance.countDocuments({
        assignedTo: handler._id
      });

      console.log(`   ${handler.name}: ${grievancesForHandler} grievance(s)`);

      if (grievancesForHandler > 0) {
        const samples = await Grievance.find({
          assignedTo: handler._id
        }).select('referenceNumber office status').limit(3);

        samples.forEach(g => {
          console.log(`      ✓ ${g.referenceNumber} (office: ${g.office}, status: ${g.status})`);
        });
      }
    }

    console.log('\n');
    mongoose.disconnect();
  } catch (error) {
    console.error('Diagnostic error:', error.message);
    process.exit(1);
  }
}

diagnoseGrievances();
