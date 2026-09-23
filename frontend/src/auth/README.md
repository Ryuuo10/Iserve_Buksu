# Authentication System Structure

## Folder Structure
```
src/
├── auth/
│   ├── AuthPage.jsx          # Main authentication page component
│   └── components/
│       ├── LoginForm.jsx     # Login form with role selection
│       └── SignupForm.jsx    # User registration form
├── pages/
│   ├── LandingPage.jsx       # Main landing page
│   ├── AdminDashboard.jsx    # Administrator dashboard
│   ├── ComplainantDashboard.jsx # Complainant dashboard
│   └── OfficeDashboard.jsx   # Office handler dashboard
└── App.jsx                   # Main app with routing
```

## User Roles

### 1. Administrator (`/admin`)
- Full system access and management
- Can create/modify user accounts
- Overview of all grievances
- System configuration and reports

### 2. Complainant (`/complainant`)
- Students or individuals filing grievances
- Submit new complaints
- Track status of their cases
- View resolution history

### 3. Office Handler (`/office`)
- Department/office representatives
- Process assigned grievances
- Update case status
- Communicate with complainants

## Authentication Flow

1. **Landing Page** → Users click role-specific buttons
2. **Auth Page** (`/auth`) → Login or Signup options
3. **Role Selection** → Choose specific role (admin/complainant/office)
4. **Dashboard** → Redirected to appropriate dashboard

## Features

### LoginForm.jsx
- Role-based login selection
- Visual role indicators with icons
- Direct navigation to dashboards
- Responsive design

### SignupForm.jsx
- Role-specific registration
- Form validation
- Administrator accounts restricted (must be created by admins)
- Email verification support

### AuthPage.jsx
- Clean, modern UI with gradient background
- Tab switching between login/signup
- Persistent role selection from URL parameters
- Consistent branding with logo

## Routing

- `/` - Landing Page
- `/auth` - Authentication page
- `/auth?role=admin` - Authentication with admin role pre-selected
- `/auth?role=complainant` - Authentication with complainant role pre-selected
- `/auth?role=office` - Authentication with office role pre-selected
- `/admin` - Administrator dashboard
- `/complainant` - Complainant dashboard
- `/office` - Office handler dashboard

## Color Scheme by Role

- **Administrator**: Blue/Indigo gradient
- **Complainant**: Green gradient  
- **Office Handler**: Purple gradient
- **System**: Blue/Cyan gradient (main brand)

## Future Improvements

- Password reset functionality
- Email verification workflow
- Two-factor authentication
- Role-based permissions system
- Audit logging for authentication events