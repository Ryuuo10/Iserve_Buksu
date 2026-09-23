const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const { connectDB } = require('../config/db');
const Grievance = require('../models/Grievance');
const { analyzeComplaint, warmupAiWorker } = require('../services/aiPipelineClient');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ALLOWED_PRIORITY = ['low', 'medium', 'high', 'critical'];

const getArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return '';
  }

  return String(process.argv[index + 1] || '').trim();
};

const buildCombinedText = (grievance) =>
  [
    String(grievance.subject || '').trim(),
    String(grievance.description || '').trim(),
    String(grievance.personInvolved || '').trim(),
    String(grievance.incidentDate || '').trim(),
  ]
    .filter(Boolean)
    .join('\n');

const mapPriorityFromAi = (aiAnalysis) => {
  const label = String(aiAnalysis?.urgency?.label || '').trim().toLowerCase();
  return ALLOWED_PRIORITY.includes(label) ? label : 'medium';
};

async function main() {
  const referenceNumber = getArgValue('--reference');
  const limitValue = Number(getArgValue('--limit'));
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 0;

  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected. Check MONGODB_URI before running this script.');
  }

  await warmupAiWorker();

  const query = { archived: { $ne: true } };
  if (referenceNumber) {
    query.referenceNumber = referenceNumber;
  }

  let grievanceQuery = Grievance.find(query).sort({ createdAt: -1 });
  if (limit > 0) {
    grievanceQuery = grievanceQuery.limit(limit);
  }

  const grievances = await grievanceQuery;
  if (grievances.length === 0) {
    console.log('No grievances found for reanalysis.');
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (const grievance of grievances) {
    const combinedText = buildCombinedText(grievance);
    if (!combinedText) {
      console.log(`SKIP ${grievance.referenceNumber}: no analyzable text`);
      continue;
    }

    try {
      const aiAnalysis = await analyzeComplaint(combinedText);
      await Grievance.findByIdAndUpdate(grievance._id, {
        aiAnalysis,
        aiAnalysisStatus: 'completed',
        aiAnalysisError: '',
        category: String(aiAnalysis?.category?.label || grievance.category || 'general').trim(),
        priority: mapPriorityFromAi(aiAnalysis),
      });

      successCount += 1;
      console.log(
        `UPDATED ${grievance.referenceNumber}: ${aiAnalysis?.category?.label || '--'} | ${aiAnalysis?.urgency?.label || '--'} | ${aiAnalysis?.sentiment?.label || '--'}`
      );
    } catch (error) {
      failureCount += 1;
      console.error(`FAILED ${grievance.referenceNumber}: ${error.message}`);

      await Grievance.findByIdAndUpdate(grievance._id, {
        aiAnalysisStatus: 'failed',
        aiAnalysisError: String(error.message || 'AI analysis failed').slice(0, 1000),
      }).catch(() => {});
    }
  }

  console.log(`Reanalysis complete. Updated: ${successCount}. Failed: ${failureCount}.`);
}

main()
  .catch((error) => {
    console.error('Reanalysis script failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
