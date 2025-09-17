#!/usr/bin/env node
// VOICE-CMD Comprehensive Test Suite
// Tests all functionality and validates system integrity

const https = require('https');
const http = require('http');

const BACKEND_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:8000';

// Test configuration
const TEST_CONFIG = {
    timeout: 5000,
    retries: 3
};

// Test results tracking
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

// Utility function to make HTTP requests
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const request = http.request(url, options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: response.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: response.statusCode, data: data });
                }
            });
        });
        
        request.on('error', reject);
        request.setTimeout(TEST_CONFIG.timeout, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (options.body) {
            request.write(options.body);
        }
        request.end();
    });
}

// Test runner
async function runTest(testName, testFunction) {
    testResults.total++;
    process.stdout.write(`Testing ${testName}... `);
    
    try {
        await testFunction();
        testResults.passed++;
        console.log('✅ PASSED');
    } catch (error) {
        testResults.failed++;
        testResults.errors.push({ test: testName, error: error.message });
        console.log('❌ FAILED');
        console.log(`   Error: ${error.message}`);
    }
}

// Test 1: Backend Server Health
async function testBackendHealth() {
    const response = await makeRequest(`${BACKEND_URL}/`);
    if (response.status !== 200) {
        throw new Error(`Backend not responding: ${response.status}`);
    }
    if (!response.data.status || response.data.status !== 'Backend server running') {
        throw new Error('Backend status incorrect');
    }
}

// Test 2: Frontend Accessibility
async function testFrontendAccess() {
    const response = await makeRequest(`${FRONTEND_URL}/`);
    if (response.status !== 200) {
        throw new Error(`Frontend not accessible: ${response.status}`);
    }
    if (!response.data.includes('VOICE-CMD')) {
        throw new Error('Frontend content incorrect');
    }
}

// Test 3: Allowed Commands
async function testAllowedCommands() {
    const allowedCommands = [
        { command: 'ls', expectedAction: 'Shell Command' },
        { command: 'pwd', expectedAction: 'Shell Command' },
        { command: 'create file test_allowed.txt', expectedAction: 'Create File' },
        { command: 'list files', expectedAction: 'List Files' },
        { command: 'remember test key is test value', expectedAction: 'Save Memory' },
        { command: 'recall test key', expectedAction: 'Recall Memory' }
    ];

    for (const test of allowedCommands) {
        const response = await makeRequest(`${BACKEND_URL}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandText: test.command })
        });

        if (response.status !== 200) {
            throw new Error(`Command failed: ${test.command} - Status: ${response.status}`);
        }

        if (!response.data.success) {
            throw new Error(`Command failed: ${test.command} - ${response.data.result}`);
        }

        if (response.data.action !== test.expectedAction) {
            throw new Error(`Action mismatch: ${test.command} - Expected: ${test.expectedAction}, Got: ${response.data.action}`);
        }
    }
}

// Test 4: Blocked Commands
async function testBlockedCommands() {
    const blockedCommands = [
        'rm -rf /',
        'shutdown',
        'sudo su',
        'kill -9 1',
        'hack'
    ];

    for (const command of blockedCommands) {
        const response = await makeRequest(`${BACKEND_URL}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandText: command })
        });

        if (response.status !== 200) {
            throw new Error(`Blocked command test failed: ${command} - Status: ${response.status}`);
        }

        if (response.data.success) {
            throw new Error(`Command should be blocked: ${command}`);
        }

        if (!response.data.result.includes('blocked') && !response.data.result.includes('BLOCKED')) {
            throw new Error(`Blocked command warning missing: ${command}`);
        }
    }
}

// Test 5: Working Directory Sandboxing
async function testWorkingDirectorySandboxing() {
    const response = await makeRequest(`${BACKEND_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandText: 'pwd' })
    });

    if (response.status !== 200 || !response.data.success) {
        throw new Error('pwd command failed');
    }

    const workingDir = response.data.result.trim();
    if (!workingDir.includes('VOICE-CMD')) {
        throw new Error(`Working directory not sandboxed: ${workingDir}`);
    }
}

// Test 6: Logging System
async function testLoggingSystem() {
    const response = await makeRequest(`${BACKEND_URL}/logs/stats`);
    
    if (response.status !== 200) {
        throw new Error('Log stats endpoint failed');
    }

    if (!response.data.success) {
        throw new Error('Log stats request failed');
    }

    const stats = response.data.stats;
    if (typeof stats.totalEntries !== 'number' || stats.totalEntries < 0) {
        throw new Error('Invalid log statistics');
    }
}

// Test 7: Security System
async function testSecuritySystem() {
    const response = await makeRequest(`${BACKEND_URL}/security/stats`);
    
    if (response.status !== 200) {
        throw new Error('Security stats endpoint failed');
    }

    if (!response.data.success) {
        throw new Error('Security stats request failed');
    }

    const stats = response.data.stats;
    if (typeof stats.totalCommands !== 'number' || stats.totalCommands < 0) {
        throw new Error('Invalid security statistics');
    }
}

// Test 8: Memory System
async function testMemorySystem() {
    // Test memory save
    const saveResponse = await makeRequest(`${BACKEND_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandText: 'remember test memory key is test memory value' })
    });

    if (saveResponse.status !== 200 || !saveResponse.data.success) {
        throw new Error('Memory save failed');
    }

    // Test memory recall
    const recallResponse = await makeRequest(`${BACKEND_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandText: 'recall test memory key' })
    });

    if (recallResponse.status !== 200 || !recallResponse.data.success) {
        throw new Error('Memory recall failed');
    }
}

// Test 9: File Operations
async function testFileOperations() {
    const fileOps = [
        { command: 'create file test_file_ops.txt', expectedAction: 'Create File' },
        { command: 'list files', expectedAction: 'List Files' },
        { command: 'delete file test_file_ops.txt', expectedAction: 'Delete File' }
    ];

    for (const op of fileOps) {
        const response = await makeRequest(`${BACKEND_URL}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandText: op.command })
        });

        if (response.status !== 200 || !response.data.success) {
            throw new Error(`File operation failed: ${op.command}`);
        }

        if (response.data.action !== op.expectedAction) {
            throw new Error(`File operation action mismatch: ${op.command}`);
        }
    }
}

// Test 10: Error Handling
async function testErrorHandling() {
    const response = await makeRequest(`${BACKEND_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandText: 'nonexistent_command_12345' })
    });

    if (response.status !== 200) {
        throw new Error('Error handling test failed - server error');
    }

    // Should either be blocked or fail gracefully
    if (response.data.success) {
        throw new Error('Nonexistent command should not succeed');
    }
}

// Main test execution
async function runAllTests() {
    console.log('🚀 VOICE-CMD Comprehensive Test Suite');
    console.log('=====================================\n');

    await runTest('Backend Server Health', testBackendHealth);
    await runTest('Frontend Accessibility', testFrontendAccess);
    await runTest('Allowed Commands', testAllowedCommands);
    await runTest('Blocked Commands', testBlockedCommands);
    await runTest('Working Directory Sandboxing', testWorkingDirectorySandboxing);
    await runTest('Logging System', testLoggingSystem);
    await runTest('Security System', testSecuritySystem);
    await runTest('Memory System', testMemorySystem);
    await runTest('File Operations', testFileOperations);
    await runTest('Error Handling', testErrorHandling);

    // Test Results Summary
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.errors.forEach(error => {
            console.log(`   - ${error.test}: ${error.error}`);
        });
    }

    if (testResults.failed === 0) {
        console.log('\n🎉 All tests passed! VOICE-CMD is ready for production.');
    } else {
        console.log('\n⚠️  Some tests failed. Please review and fix issues.');
        process.exit(1);
    }
}

// Run the test suite
runAllTests().catch(error => {
    console.error('Test suite execution failed:', error);
    process.exit(1);
});


