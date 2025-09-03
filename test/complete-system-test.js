#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

const http = require('http');

const API_BASE = 'http://localhost:3003';
const FRONTEND_BASE = 'http://localhost:3002';

async function testCompleteSystem() {
    console.log(chalk.blue.bold('\n🚀 MongoDB CRUD Complete System Test\n'));
    console.log('='.repeat(50));

    try {
        // Test 1: Check all services are running
        console.log(chalk.yellow('\n📍 Testing Service Availability...\n'));
        
        console.log('1. MongoDB API Health Check...');
        const healthResponse = await axios.get(`${API_BASE}/health`);
        console.log(chalk.green('   ✓ API is healthy:', healthResponse.data.status));

        console.log('2. Frontend Availability...');
        const frontendResponse = await axios.get(FRONTEND_BASE);
        console.log(chalk.green('   ✓ Frontend is accessible (status:', frontendResponse.status, ')'));

        // Test 2: Test management interface functionality
        console.log(chalk.yellow('\n🔧 Testing Management Interface...\n'));
        
        console.log('1. List existing collections...');
        const collectionsResponse = await axios.get(`${API_BASE}/api/management/collections`);
        console.log(chalk.green('   ✓ Found', collectionsResponse.data.count, 'collections'));
        collectionsResponse.data.collections.forEach(col => {
            console.log(chalk.gray('     -', col.name));
        });

        console.log('2. Create test collection...');
        const testCollectionName = `test_${Date.now()}`;
        await axios.post(`${API_BASE}/api/management/collections`, { name: testCollectionName });
        console.log(chalk.green('   ✓ Created collection:', testCollectionName));

        // Test 3: Test collection operations
        console.log(chalk.yellow('\n📊 Testing Collection Operations...\n'));
        
        console.log('1. Add test document...');
        const testDoc = {
            name: 'Integration Test Document',
            type: 'automated_test',
            timestamp: new Date().toISOString(),
            data: { test: true, number: 42 }
        };
        const createResponse = await axios.post(`${API_BASE}/api/db/${testCollectionName}`, testDoc);
        const documentId = createResponse.data.data._id;
        console.log(chalk.green('   ✓ Document created with ID:', documentId));

        console.log('2. Retrieve document...');
        const getResponse = await axios.get(`${API_BASE}/api/db/${testCollectionName}/${documentId}`);
        console.log(chalk.green('   ✓ Document retrieved:', getResponse.data.data.name));

        console.log('3. Update document...');
        const updateData = { ...testDoc, updated: true, updatedAt: new Date().toISOString() };
        await axios.put(`${API_BASE}/api/db/${testCollectionName}/${documentId}`, updateData);
        console.log(chalk.green('   ✓ Document updated successfully'));

        console.log('4. List documents with pagination...');
        const listResponse = await axios.get(`${API_BASE}/api/db/${testCollectionName}?page=1&limit=10`);
        console.log(chalk.green('   ✓ Retrieved', listResponse.data.data.length, 'documents'));
        console.log(chalk.gray('     Pagination:', listResponse.data.pagination));

        // Test 4: Cleanup
        console.log(chalk.yellow('\n🧹 Cleanup...\n'));
        
        console.log('1. Delete test document...');
        await axios.delete(`${API_BASE}/api/db/${testCollectionName}/${documentId}`);
        console.log(chalk.green('   ✓ Document deleted'));

        console.log('2. Drop test collection...');
        await axios.delete(`${API_BASE}/api/management/collections/${testCollectionName}`);
        console.log(chalk.green('   ✓ Collection dropped'));

        // Test summary
        console.log(chalk.green.bold('\n✨ Complete System Test Results\n'));
        console.log('='.repeat(50));
        console.log(chalk.green('✓ All services running and healthy'));
        console.log(chalk.green('✓ Management interface functional'));
        console.log(chalk.green('✓ CRUD operations working'));
        console.log(chalk.green('✓ Frontend accessible'));
        console.log(chalk.green('✓ API endpoints responding correctly'));
        
        console.log(chalk.blue.bold('\n🎉 System Ready for Use!\n'));
        console.log(chalk.cyan('Frontend URL: '), chalk.white(FRONTEND_BASE));
        console.log(chalk.cyan('API URL:      '), chalk.white(API_BASE));
        console.log(chalk.cyan('MongoDB:      '), chalk.white('localhost:27017'));

    } catch (error) {
        console.error(chalk.red.bold('\n❌ Test Failed!'));
        console.error(chalk.red('Error:', error.message));
        if (error.response) {
            console.error(chalk.red('Status:', error.response.status));
            console.error(chalk.red('Data:', JSON.stringify(error.response.data, null, 2)));
        }
        process.exit(1);
    }
}

// Run the test
testCompleteSystem();
