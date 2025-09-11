#!/usr/bin/env node

/**
 * Migration script to convert _scheduled_scripts collection from string _id to ObjectId
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Reads all documents in _scheduled_scripts collection
 * 3. Creates new documents with ObjectId _id and preserves scriptName
 * 4. Removes old documents with string _id
 * 5. Validates the migration
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mongo-crud';
const DB_NAME = process.env.MONGODB_DB_NAME || 'mongo-crud';

async function migrateScheduledScripts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DB_NAME);
    console.log(`📊 Connected to database: ${DB_NAME}`);
    
    const collection = db.collection('_scheduled_scripts');
    
    // Check if collection exists
    const collections = await db.listCollections({ name: '_scheduled_scripts' }).toArray();
    if (collections.length === 0) {
      console.log('ℹ️  Collection _scheduled_scripts does not exist - no migration needed');
      return;
    }
    
    // Get all existing documents
    const existingDocs = await collection.find({}).toArray();
    console.log(`📄 Found ${existingDocs.length} documents to migrate`);
    
    if (existingDocs.length === 0) {
      console.log('ℹ️  No documents to migrate');
      return;
    }
    
    // Identify documents that need migration (string _id)
    const docsToMigrate = existingDocs.filter(doc => typeof doc._id === 'string');
    console.log(`🔄 Documents needing migration: ${docsToMigrate.length}`);
    
    if (docsToMigrate.length === 0) {
      console.log('✅ All documents already use ObjectId - no migration needed');
      return;
    }
    
    // Backup the collection
    console.log('💾 Creating backup...');
    const backupCollection = db.collection('_scheduled_scripts_backup_' + Date.now());
    if (existingDocs.length > 0) {
      await backupCollection.insertMany(existingDocs);
      console.log(`✅ Backup created: ${backupCollection.collectionName}`);
    }
    
    // Migrate documents
    let migrated = 0;
    for (const doc of docsToMigrate) {
      try {
        const oldId = doc._id;
        
        // Create new document with ObjectId and proper structure
        const newDoc = {
          ...doc,
          _id: new ObjectId(), // Generate new ObjectId
          scriptId: oldId,     // Store original ID as scriptId
          scriptName: doc.scriptName || doc.scriptId || oldId, // Ensure scriptName exists
          updatedAt: new Date()
        };
        
        // Remove the old document
        await collection.deleteOne({ _id: oldId });
        
        // Insert the new document
        await collection.insertOne(newDoc);
        
        console.log(`✅ Migrated: ${oldId} -> ${newDoc._id} (scriptName: ${newDoc.scriptName})`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ Failed to migrate document ${doc._id}:`, error.message);
      }
    }
    
    // Validate migration
    console.log('🔍 Validating migration...');
    const finalDocs = await collection.find({}).toArray();
    const objectIdDocs = finalDocs.filter(doc => ObjectId.isValid(doc._id) && typeof doc._id !== 'string');
    const stringIdDocs = finalDocs.filter(doc => typeof doc._id === 'string');
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Original documents: ${existingDocs.length}`);
    console.log(`   Documents migrated: ${migrated}`);
    console.log(`   Final ObjectId documents: ${objectIdDocs.length}`);
    console.log(`   Remaining string ID documents: ${stringIdDocs.length}`);
    
    if (stringIdDocs.length > 0) {
      console.log('⚠️  Warning: Some documents still have string IDs:');
      stringIdDocs.forEach(doc => console.log(`   - ${doc._id}`));
    }
    
    if (migrated === docsToMigrate.length && stringIdDocs.length === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with issues - please review');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔐 Database connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateScheduledScripts()
    .then(() => {
      console.log('🎉 Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateScheduledScripts };
