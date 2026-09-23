const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SAMPLE_GRIEVANCES = [
  {
    subject: 'Delayed release of grades for final term',
    description: 'The final grades for two major subjects have not been posted even after the expected release date, which is affecting scholarship renewal requirements.',
    category: 'academic',
    office: 'Registrar',
    priority: 'high',
    status: 'pending',
    incidentDate: '2026-03-01',
    isAnonymous: false,
  },
  {
    subject: 'Air conditioning not working in lecture room',
    description: 'Room B204 has had no working air conditioning for several sessions, making afternoon classes difficult to attend comfortably.',
    category: 'facility',
    office: 'Facilities Management',
    priority: 'medium',
    status: 'under_review',
    incidentDate: '2026-02-26',
    isAnonymous: false,
  },
  {
    subject: 'Incorrect library penalty posted to account',
    description: 'A library fine was added to my student account even though the borrowed material was returned on time and acknowledged by the staff.',
    category: 'financial',
    office: 'Library Services',
    priority: 'medium',
    status: 'in_progress',
    incidentDate: '2026-02-19',
    isAnonymous: false,
  },
  {
    subject: 'Unsanitary condition in comfort room',
    description: 'The comfort room in the east wing has not been cleaned regularly and has no soap dispenser for several days.',
    category: 'facility',
    office: 'General Services',
    priority: 'high',
    status: 'escalated',
    incidentDate: '2026-02-14',
    isAnonymous: true,
  },
  {
    subject: 'No response to enrollment correction request',
    description: 'A request to correct an enrollment record was submitted last week, but there has been no update despite multiple follow-ups.',
    category: 'administrative',
    office: 'Registrar',
    priority: 'high',
    status: 'resolved',
    incidentDate: '2026-02-10',
    isAnonymous: false,
    resolutionNotes: 'Enrollment record was corrected and the updated registration form was issued.',
  },
  {
    subject: 'Internet connection unstable in computer lab',
    description: 'Lab computers frequently disconnect from the network during practical sessions, interrupting quizzes and online submissions.',
    category: 'technology',
    office: 'ICT Office',
    priority: 'medium',
    status: 'pending',
    incidentDate: '2026-02-08',
    isAnonymous: false,
  },
  {
    subject: 'Overcrowding in shuttle waiting area',
    description: 'The waiting area near the transport shed becomes too crowded during peak hours and needs better queue management.',
    category: 'student_services',
    office: 'Student Affairs',
    priority: 'low',
    status: 'under_review',
    incidentDate: '2026-02-03',
    isAnonymous: true,
  },
  {
    subject: 'Harassment concern during group activity',
    description: 'A classmate repeatedly made inappropriate remarks during a required group activity, which created an unsafe environment.',
    category: 'conduct',
    office: 'Guidance Office',
    priority: 'critical',
    status: 'in_progress',
    incidentDate: '2026-01-29',
    isAnonymous: true,
  },
  {
    subject: 'Scholarship stipend has not been released',
    description: 'The scholarship stipend for the previous month has not yet been released, and no advisory has been given to beneficiaries.',
    category: 'financial',
    office: 'Scholarship Office',
    priority: 'high',
    status: 'rejected',
    incidentDate: '2026-01-24',
    isAnonymous: false,
    resolutionNotes: 'The complaint was closed after verification showed the stipend schedule had been moved under the revised disbursement calendar.',
  },
  {
    subject: 'Broken chairs in discussion room',
    description: 'Several chairs in discussion room C12 have broken legs and are unsafe for students during class meetings.',
    category: 'facility',
    office: 'Facilities Management',
    priority: 'medium',
    status: 'resolved',
    incidentDate: '2026-01-18',
    isAnonymous: false,
    resolutionNotes: 'Damaged chairs were replaced and the room was cleared for use.',
  },
];

const makeReferenceNumber = (index) => {
  const year = new Date().getFullYear();
  const serial = String(index + 1).padStart(4, '0');
  const suffix = String(Date.now()).slice(-4);
  return `GRV-${year}-${serial}${suffix}`;
};

const makeTrackingId = (index) => {
  const year = new Date().getFullYear();
  const serial = String(index + 1).padStart(4, '0');
  const suffix = String(Date.now()).slice(-5);
  return `TRK-${year}-${serial}${suffix}`;
};

const makeGrievanceId = (index) => {
  const year = new Date().getFullYear();
  const serial = String(index + 1).padStart(4, '0');
  const suffix = String(Date.now()).slice(-6);
  return `GID-${year}-${serial}${suffix}`;
};

const buildCreatedAt = (index) => {
  const base = new Date('2026-01-15T08:00:00.000Z');
  base.setDate(base.getDate() + index * 4);
  return base;
};

async function seedGrievances() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const complainants = await User.find({ role: 'complainant' })
    .select('_id name email')
    .sort({ createdAt: 1 })
    .limit(10);

  const docs = SAMPLE_GRIEVANCES.map((item, index) => {
    const complainant = complainants.length ? complainants[index % complainants.length] : null;
    const createdAt = buildCreatedAt(index);
    const resolvedAt = item.status === 'resolved' ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000) : null;

    return {
      trackingId: makeTrackingId(index),
      grievanceId: makeGrievanceId(index),
      referenceNumber: makeReferenceNumber(index),
      subject: item.subject,
      description: item.description,
      category: item.category,
      office: item.office,
      incidentDate: item.incidentDate,
      priority: item.priority,
      status: item.status,
      complainantId: item.isAnonymous ? null : complainant?._id || null,
      complainantName: item.isAnonymous ? null : complainant?.name || `Sample Complainant ${index + 1}`,
      complainantEmail: item.isAnonymous ? null : complainant?.email || `complainant${index + 1}@example.com`,
      isAnonymous: item.isAnonymous,
      attachments: [],
      aiAnalysis: null,
      resolutionNotes: item.resolutionNotes || '',
      resolvedAt,
      assignedTo: null,
      assignedBy: null,
      assignedAt: null,
      lastUpdatedBy: null,
      createdAt,
      updatedAt: resolvedAt || createdAt,
    };
  });

  const result = await mongoose.connection.collection('grievances').insertMany(docs, { ordered: true });

  console.log(`Inserted ${result.insertedCount} grievance records.`);
  docs.forEach((doc) => {
    console.log(`${doc.referenceNumber} | ${doc.subject}`);
  });
}

seedGrievances()
  .catch((error) => {
    console.error('Failed to seed grievances:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
