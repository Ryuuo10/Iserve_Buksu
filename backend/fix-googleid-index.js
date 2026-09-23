const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function fixGoogleIdIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Drop the existing googleId index
    await User.collection.dropIndex('googleId_1');
    console.log('✅ Dropped googleId_1 index');
    
    // Create the proper sparse index
    await User.collection.createIndex(
      { googleId: 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'googleId_1_sparse'
      }
    );
    console.log('✅ Created sparse googleId index');
    
    // List current indexes
    const indexes = await User.collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing index:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  }
}

fixGoogleIdIndex();
