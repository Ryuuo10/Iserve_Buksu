const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

const RETRY_DELAY_MS = Number(process.env.MONGODB_RETRY_DELAY_MS) || 15000;

let connectPromise = null;
let reconnectTimer = null;
let lastConnectionError = null;

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const getDatabaseStatus = () => ({
  connected: isDatabaseReady(),
  readyState: mongoose.connection.readyState,
  host: mongoose.connection.host || null,
  database: mongoose.connection.name || null,
  lastError: lastConnectionError
    ? {
        message: lastConnectionError.message,
        code: lastConnectionError.code || null,
      }
    : null,
});

const scheduleReconnect = () => {
  if (reconnectTimer || isDatabaseReady()) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDB().catch(() => {});
  }, RETRY_DELAY_MS);
};

const connectDB = async () => {
  if (isDatabaseReady()) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  if (!process.env.MONGODB_URI) {
    lastConnectionError = new Error('MONGODB_URI is not configured');
    console.error('Error connecting to MongoDB:', lastConnectionError.message);
    scheduleReconnect();
    return null;
  }

  connectPromise = mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })
    .then((conn) => {
      lastConnectionError = null;
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    })
    .catch((error) => {
      lastConnectionError = error;
      console.error('Error connecting to MongoDB:', error);
      scheduleReconnect();
      return null;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

mongoose.connection.on('disconnected', () => {
  if (!lastConnectionError) {
    lastConnectionError = new Error('MongoDB connection disconnected');
  }
  console.warn('MongoDB disconnected. Retrying connection...');
  scheduleReconnect();
});

mongoose.connection.on('error', (error) => {
  lastConnectionError = error;
});

module.exports = {
  connectDB,
  isDatabaseReady,
  getDatabaseStatus,
};
