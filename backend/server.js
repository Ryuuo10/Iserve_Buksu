require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { connectDB, isDatabaseReady, getDatabaseStatus } = require('./config/db');
const User = require('./models/User');
const { syncAcademicOfficeCategories } = require('./utils/officeCategoryCatalog');
const { warmupAiWorker } = require('./services/aiPipelineClient');
const { setIO } = require('./utils/socketServer');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
console.log('Attempting to connect to MongoDB...');
connectDB().then((connection) => {
  if (!connection) {
    return;
  }

  console.log('Database connection established');
  syncAcademicOfficeCategories()
    .then(() => {
      console.log('Office category catalog synchronized');
    })
    .catch((error) => {
      console.error('Failed to synchronize office category catalog:', error);
    });
});

// Middleware
app.use((req, res, next) => {
  res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'https://capstone-frontend-iojn.onrender.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  const database = getDatabaseStatus();

  res.status(200).json({
    success: true,
    message: database.connected
      ? 'Server is running!'
      : 'Server is running, but the database is unavailable on this machine.',
    port: currentPort,
    database,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }

  if (isDatabaseReady()) {
    return next();
  }

  return res.status(503).json({
    success: false,
    message: 'Database unavailable. Check MongoDB Atlas access or local DNS/network settings on this laptop.',
    database: getDatabaseStatus(),
  });
});

// Socket.IO initialization with JWT authentication
const io = socketIO(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      'https://capstone-frontend-iojn.onrender.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174'
    ],
    credentials: true
  }
});

// Socket.IO JWT verification middleware
io.use(async (socket, next) => {
  try {
    if (!isDatabaseReady()) {
      return next(new Error('Database unavailable'));
    }

    const token = socket.handshake.auth?.token;
    const userId = socket.handshake.auth?.userId;

    if (!token || !userId) {
      console.warn('⚠️ Socket connection attempt without auth');
      return next(new Error('Authentication error: Missing token or userId'));
    }

    // Extract token (remove "Bearer " prefix if present)
    const actualToken = token.replace('Bearer ', '');

    // Verify JWT
    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);

    if (decoded.userId !== userId) {
      console.warn('❌ Socket auth mismatch: token userId != provided userId');
      return next(new Error('Authentication error: User ID mismatch'));
    }

    // Verify user exists and is active
    const user = await User.findById(userId);
    if (!user) {
      console.warn('❌ Socket auth failed: user not found');
      return next(new Error('Authentication error: User not found'));
    }

    if (user.status !== 'active') {
      console.warn('❌ Socket auth failed: user inactive');
      return next(new Error('Authentication error: User account inactive'));
    }

    // Attach user to socket for use in handlers
    socket.user = user;
    socket.userId = userId;
    console.log(`✅ Socket authenticated for user: ${user.email}`);

    next();
  } catch (error) {
    console.error('❌ Socket authentication error:', error.message);
    next(new Error(`Authentication error: ${error.message}`));
  }
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id} (User: ${socket.user?.email})`);

  const roleRooms = new Set([`role_${socket.user.role}`]);
  if (socket.user.role === 'superadmin') {
    roleRooms.add('role_admin');
  }

  roleRooms.forEach((room) => socket.join(room));

  // Join user room with validated auth
  socket.on('join_user_room', (data) => {
    // data can be either userId (old format) or { userId, token } (new format)
    const userId = typeof data === 'string' ? data : data?.userId;
    const token = typeof data === 'object' ? data?.token : null;

    if (!userId) {
      console.warn('⚠️ join_user_room called without userId');
      return;
    }

    // Verify user matches authenticated socket user
    if (socket.user._id.toString() !== userId) {
      console.warn(`❌ Security violation: Socket user ${socket.user._id} tried to join room for ${userId}`);
      socket.emit('auth_error', {
        message: 'Authorization failed: Cannot join another user\'s room'
      });
      return;
    }

    socket.join(`user_${userId}`);
    console.log(`✅ User ${userId} joined their room`);
    
    // Notify user they're connected
    socket.emit('connected', {
      userId,
      userRole: socket.user.role,
      message: 'Connected to real-time updates'
    });
  });

  // Leave user room
  socket.on('leave_user_room', (userId) => {
    if (socket.user._id.toString() === userId) {
      socket.leave(`user_${userId}`);
      console.log(`✅ User ${userId} left their room`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id} (User: ${socket.user?.email})`);
  });
});

// Make io accessible to routes
app.set('io', io);
app.locals.io = io;
setIO(io);

// Import and mount auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Office management routes
const officeRoutes = require('./routes/offices');
app.use('/api/offices', officeRoutes);

// Profile completion routes
const profileRoutes = require('./routes/profile');
app.use('/api/profile', profileRoutes);

// Protected/test routes
const protectedRoutes = require('./routes/protected');
app.use('/api/protected', protectedRoutes);
const grievanceRoutes = require('./routes/grievances');
app.use('/api/grievances', grievanceRoutes);

// Dialogflow conversational endpoint – the front end sends user messages here
const dialogflowRouter = require('./routes/dialogflow');
app.use('/api/dialogflow', dialogflowRouter);

// Cloudinary file upload routes
const cloudinaryRouter = require('./routes/cloudinary');
app.use('/api/cloudinary', cloudinaryRouter);

// Admin user management routes
const adminUserManagementRouter = require('./routes/adminUserManagement');
app.use('/api/admin', adminUserManagementRouter);

// Admin grievance management routes
const adminGrievancesRouter = require('./routes/adminGrievances');
app.use('/api/admin', adminGrievancesRouter);

// Admin superadmin management routes (users, settings, audit logs)
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

// Notification routes
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

// Support ticket routes
const supportRoutes = require('./routes/support');
app.use('/api/support', supportRoutes);

const DEFAULT_PORT = Number(process.env.PORT) || 5000;

let currentPort = DEFAULT_PORT;

function startServer() {
  server.listen(currentPort, () => {
    console.log(`✅ Server running on port ${currentPort}`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️  Port ${currentPort} is already in use. Trying ${currentPort + 1} instead...`);
    currentPort += 1;
    server.close();
    setTimeout(() => startServer(), 100);
  } else {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
});

startServer();

const shouldWarmupAiWorker = process.env.AI_PIPELINE_WARMUP === 'true';

if (shouldWarmupAiWorker) {
  setTimeout(() => {
    warmupAiWorker().catch(() => {});
  }, 250);
} else {
  console.log('[ai_pipeline] Startup warmup disabled. Set AI_PIPELINE_WARMUP=true to enable it.');
}
