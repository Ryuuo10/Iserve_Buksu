const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Get the users collection
    const db = mongoose.connection.db;
    const collection = db.collection('users');
    
    // Check existing indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Remove the googleId_1 index if it exists
    try {
      await collection.dropIndex('googleId_1');
      console.log('Successfully removed googleId_1 index');
    } catch (error) {
      console.log('Index googleId_1 does not exist or could not be removed:', error.message);
    }
    
    // Verify indexes after removal
    const newIndexList = await collection.indexes();
    console.log('\nIndexes after removal:');
    newIndexList.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  })
  .catch(error => {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  });