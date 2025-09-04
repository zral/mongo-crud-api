#!/usr/bin/env node

/**
 * Test CSV Export Functionality
 * Tests the new CSV export feature for collection endpoints
 */

const axios = require('axios');
const fs = require('fs').promises;

const API_BASE = 'http://localhost:3003';

async function testCSVExport() {
    console.log('🧪 Testing CSV Export Functionality\n');

    try {
        // 1. First, add some test data
        console.log('📊 Setting up test data...');
        
        const testUsers = [
            { name: 'John Doe', email: 'john@example.com', age: 30, department: 'Engineering' },
            { name: 'Jane Smith', email: 'jane@example.com', age: 25, department: 'Sales' },
            { name: 'Bob Johnson', email: 'bob@example.com', age: 35, department: 'Marketing' },
            { name: 'Alice Brown', email: 'alice@example.com', age: 28, department: 'Engineering' }
        ];

        // Add test users
        for (const user of testUsers) {
            await axios.post(`${API_BASE}/api/db/users`, user);
        }
        console.log('✅ Test data added\n');

        // 2. Test CSV export with format parameter
        console.log('📝 Testing CSV export with ?format=csv...');
        const csvResponse1 = await axios.get(`${API_BASE}/api/db/users?format=csv`);
        
        console.log('Response headers:', {
            'content-type': csvResponse1.headers['content-type'],
            'content-disposition': csvResponse1.headers['content-disposition']
        });
        console.log('CSV Data (first 200 chars):', csvResponse1.data.substring(0, 200) + '...\n');

        // 3. Test CSV export with Accept header
        console.log('📝 Testing CSV export with Accept: text/csv header...');
        const csvResponse2 = await axios.get(`${API_BASE}/api/db/users`, {
            headers: { 'Accept': 'text/csv' }
        });
        
        console.log('Response headers:', {
            'content-type': csvResponse2.headers['content-type'],
            'content-disposition': csvResponse2.headers['content-disposition']
        });
        console.log('CSV Data (first 200 chars):', csvResponse2.data.substring(0, 200) + '...\n');

        // 4. Test CSV export with filtering
        console.log('📝 Testing CSV export with filtering...');
        const csvResponse3 = await axios.get(`${API_BASE}/api/db/users?department=Engineering&format=csv`);
        
        console.log('Filtered CSV Data:', csvResponse3.data);
        console.log('');

        // 5. Test CSV export with field selection
        console.log('📝 Testing CSV export with field selection...');
        const csvResponse4 = await axios.get(`${API_BASE}/api/db/users?fields=name,email&format=csv`);
        
        console.log('Selected fields CSV Data:', csvResponse4.data);
        console.log('');

        // 6. Save CSV files for inspection
        console.log('💾 Saving CSV files...');
        await fs.writeFile('./test_users_all.csv', csvResponse1.data);
        await fs.writeFile('./test_users_engineering.csv', csvResponse3.data);
        await fs.writeFile('./test_users_contacts.csv', csvResponse4.data);
        console.log('✅ CSV files saved: test_users_all.csv, test_users_engineering.csv, test_users_contacts.csv\n');

        // 7. Test regular JSON response still works
        console.log('📝 Testing regular JSON response still works...');
        const jsonResponse = await axios.get(`${API_BASE}/api/db/users`);
        console.log(`JSON Response: ${jsonResponse.data.data.length} users returned`);
        console.log('Sample user:', JSON.stringify(jsonResponse.data.data[0], null, 2));

        console.log('\n🎉 All CSV export tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status) {
            console.error('Status:', error.response.status);
        }
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testCSVExport();
}

module.exports = { testCSVExport };
