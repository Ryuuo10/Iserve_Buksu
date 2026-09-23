export const MAX_FILE_COUNT = 3;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const categoryOptions = [
  { id: 'filing', name: 'Filing', description: 'Starting and submitting a grievance' },
  { id: 'tracking', name: 'Tracking', description: 'Status, routing, and updates' },
  { id: 'account', name: 'Account', description: 'Profile, sign in, and password help' },
  { id: 'technical', name: 'Technical', description: 'Uploads, browser, and loading issues' },
  { id: 'privacy', name: 'Privacy', description: 'Anonymous filing and data handling' },
  { id: 'general', name: 'General', description: 'Anything that does not fit another category' },
];

export const guideCards = [
  {
    id: 'file-grievance',
    category: 'filing',
    title: 'How to file a grievance',
    description: 'Review the essentials before submitting a new grievance.',
    steps: [
      'Open the grievance filing module in your complainant dashboard.',
      'Write a clear subject and a factual description of the issue.',
      'Choose the most accurate category or office when prompted.',
      'Attach files only when they help explain the concern.',
      'Submit and keep the tracking ID for follow-up.',
    ],
  },
  {
    id: 'track-grievance',
    category: 'tracking',
    title: 'How to track grievance progress',
    description: 'Understand your current status and recent activity.',
    steps: [
      'Open My Grievances or the grievance tracker.',
      'Select the grievance you want to review.',
      'Check the status, assigned office, and latest updates.',
      'Review any note requesting clarification or added evidence.',
    ],
  },
  {
    id: 'update-profile',
    category: 'account',
    title: 'How to update your profile',
    description: 'Keep your account details accurate for follow-up.',
    steps: [
      'Open Profile or Account Settings.',
      'Review your email, contact number, and profile details.',
      'Save your changes carefully.',
      'Use a support ticket if a field cannot be edited.',
    ],
  },
  {
    id: 'reset-password',
    category: 'account',
    title: 'How to reset your password',
    description: 'Use this when you cannot sign in with your current password.',
    steps: [
      'Choose Forgot Password on the login page.',
      'Enter the email address linked to your account.',
      'Follow the reset instructions from your inbox.',
      'Check spam first if the reset email does not arrive.',
    ],
  },
  {
    id: 'fix-uploads',
    category: 'technical',
    title: 'Fix common upload problems',
    description: 'Resolve the usual reasons files fail to upload.',
    steps: [
      'Keep each file under 10MB.',
      'Use supported formats such as PDF, JPG, PNG, MP4, AVI, or MOV.',
      'Retry on a stable connection if the upload stalls.',
      'Use a current browser version when possible.',
    ],
  },
  {
    id: 'privacy-options',
    category: 'privacy',
    title: 'Understand privacy and anonymous filing',
    description: 'Know what information to share and what to avoid.',
    steps: [
      'Choose anonymous filing only when it fits your case.',
      'Share only information needed to understand the issue.',
      'Remove unrelated personal data from files when possible.',
      'Use a support ticket if you need clarification before filing.',
    ],
  },
];

export const faqByCategory = {
  filing: [
    {
      question: 'What should I prepare before filing a grievance?',
      answer: 'Prepare a clear subject, a factual description, the incident date if known, and any file that supports the issue.',
    },
    {
      question: 'Should I attach evidence to every grievance?',
      answer: 'No. Attach evidence only when it genuinely helps explain or verify the concern.',
    },
    {
      question: 'Can I submit more than one grievance?',
      answer: 'Yes, but each grievance should represent a separate issue instead of duplicating the same report.',
    },
  ],
  tracking: [
    {
      question: 'Where can I see the status of my grievance?',
      answer: 'Use the tracker or My Grievances area in your dashboard to review the latest status and updates.',
    },
    {
      question: 'Why did my grievance move to another office?',
      answer: 'A grievance may be rerouted when another office is better positioned to review and handle it.',
    },
    {
      question: 'How long does resolution usually take?',
      answer: 'That depends on the issue. Straightforward cases move faster than cases needing verification or multiple offices.',
    },
  ],
  account: [
    {
      question: 'What should I do if I cannot sign in?',
      answer: 'Reset your password first. If that does not work, submit a support ticket with your account email and the error you saw.',
    },
    {
      question: 'Can I change my profile details later?',
      answer: 'Yes. Use your Profile or Account Settings module to update supported fields.',
    },
    {
      question: 'Why is my account information incorrect?',
      answer: 'Some information comes from registration or linked account data. If a field is locked, submit a support ticket.',
    },
  ],
  technical: [
    {
      question: 'The page is slow. What should I try first?',
      answer: 'Refresh the page, check your connection, and try a current browser version. Large uploads can also affect performance.',
    },
    {
      question: 'Why does my file upload fail?',
      answer: 'Common causes include unsupported types, files above 10MB, or interrupted connections.',
    },
    {
      question: 'Can I submit grievances on a phone?',
      answer: 'Yes, but large uploads are generally more reliable on a desktop or laptop connection.',
    },
  ],
  privacy: [
    {
      question: 'Can I file anonymously?',
      answer: 'Yes, if that option is available in the grievance workflow. Anonymous reports still need enough detail to be reviewed.',
    },
    {
      question: 'Who can see my information?',
      answer: 'Authorized system users involved in handling your case should be the ones with access to grievance records.',
    },
    {
      question: 'Should I include personal identifiers in attachments?',
      answer: 'Only if that information is necessary to understand or verify the issue.',
    },
  ],
  general: [
    {
      question: 'When should I use a support ticket instead of a grievance?',
      answer: 'Use a support ticket for system help, account issues, or guidance before filing a grievance.',
    },
    {
      question: 'What should I write in a support ticket?',
      answer: 'Describe the problem clearly, explain what you expected, and add a file only if it helps explain the issue.',
    },
    {
      question: 'Can I update my ticket after submitting it?',
      answer: 'Yes. Open the ticket from My Support Tickets and add more details when needed.',
    },
  ],
};

export const contactInfo = [
  {
    title: 'IT Help Desk',
    email: 'support@buksu.edu.ph',
    phone: '(088) 123-4567',
    hours: 'Monday to Friday, 8:00 AM to 5:00 PM',
    location: 'IT Building, Room 101',
  },
  {
    title: 'Student Affairs',
    email: 'student.affairs@buksu.edu.ph',
    phone: '(088) 234-5678',
    hours: 'Monday to Friday, 8:00 AM to 6:00 PM',
    location: 'Student Center, 2nd Floor',
  },
  {
    title: 'Academic Affairs',
    email: 'academic.affairs@buksu.edu.ph',
    phone: '(088) 345-6789',
    hours: 'Monday to Friday, 8:00 AM to 5:00 PM',
    location: 'Administration Building',
  },
];
