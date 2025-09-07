#!/usr/bin/env node

/**
 * Rollback script to revert 'name' back to 'scriptName' in _scheduled_scripts collection
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Updates all documents in _scheduled_scripts collection
 * 3. Renames the 'name' field back to 'scriptName'
 * 4. Removes migration metadata
 */

const { MongoClient } = require('mongodb');

// Configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'crud_api';

async function rollbackScheduledScripts() {
  let client;
  
  try {
    console.log('🔄 Starting rollback: name → scriptName in _scheduled_scripts collection');
    
    // Connect to MongoDB
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('_scheduled_scripts');
    
    // Check if collection exists
    const collections = await db.listCollections({ name: '_scheduled_scripts' }).toArray();
    if (collections.length === 0) {
      console.log('ℹ️  Collection _scheduled_scripts does not exist - nothing to rollback');
      return;
    }
    
    // Count documents with name field (migrated documents)
    const documentsWithName = await collection.countDocuments({ name: { $exists: true } });
    console.log(`📊 Found ${documentsWithName} documents with 'name' field to rollback`);
    
    if (documentsWithName === 0) {
      console.log('✅ No documents need rollback');
      return;
    }
    
    // Rollback: rename name back to scriptName and remove migration metadata
    const result = await collection.updateMany(
      { name: { $exists: true } },
      { 
        $rename: { name: 'scriptName' },
        $unset: { 
          migratedAt: "",
          migrationVersion: ""
        },
        $set: {
          rolledBackAt: new Date()
        }
      }
    );
    
    console.log(`✅ Rollback completed successfully:`);
    console.log(`   - Documents matched: ${result.matchedCount}`);
    console.log(`   - Documents modified: ${result.modifiedCount}`);
    
    // Verify rollback
    const documentsWithScriptName = await collection.countDocuments({ scriptName: { $exists: true } });
    const remainingName = await collection.countDocuments({ name: { $exists: true } });
    
    console.log(`📊 Post-rollback verification:`);
    console.log(`   - Documents with 'scriptName' field: ${documentsWithScriptName}`);
    console.log(`   - Documents with 'name' field: ${remainingName}`);
    
    if (remainingName === 0) {
      console.log('🎉 Rollback successful - all documents reverted to scriptName!');
    } else {
      console.log('⚠️  Some documents still have name field - manual review needed');
    }
    
    // Show sample rolled back documents
    const sampleDocs = await collection.find({ scriptName: { $exists: true } }).limit(3).toArray();
    if (sampleDocs.length > 0) {
      console.log('\n📋 Sample rolled back documents:');
      sampleDocs.forEach((doc, index) => {
        console.log(`${index + 1}. Script: ${doc.scriptName}, ID: ${doc._id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('📝 Database connection closed');
    }
  }
}

// Run rollback if called directly
if (require.main === module) {
  rollbackScheduledScripts()
    .then(() => {
      console.log('\n🏁 Rollback script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Rollback script failed:', error);
      process.exit(1);
    });
}

module.exports = { rollbackScheduledScripts };
