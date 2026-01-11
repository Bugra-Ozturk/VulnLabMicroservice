/**
 * Cascading Failure Test Script
 * 
 * Demonstrates how failure in one hub component (RabbitMQ)
 * causes cascading failures throughout the system.
 * 
 * Usage: node cascade-test.js
 */

const axios = require('axios');
const { exec } = require('child_process');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

async function testEndpoint(name, config) {
    const startTime = Date.now();
    try {
        const response = await axios({
            ...config,
            timeout: 5000
        });
        const elapsed = Date.now() - startTime;
        return { name, status: 'OK', responseTime: elapsed };
    } catch (error) {
        const elapsed = Date.now() - startTime;
        return {
            name,
            status: 'FAILED',
            responseTime: elapsed,
            error: error.code || error.message
        };
    }
}

async function runHealthCheck() {
    const endpoints = [
        { name: 'Gateway Health', method: 'get', url: `${GATEWAY_URL}/health` },
        { name: 'Auth Login', method: 'post', url: `${GATEWAY_URL}/api/auth/login`, data: { username: 'admin', password: 'admin123' } },
        { name: 'Order Create', method: 'post', url: `${GATEWAY_URL}/api/orders`, data: { product: 'Test', quantity: 1 } },
        { name: 'Users List', method: 'get', url: `${GATEWAY_URL}/api/users` }
    ];

    const results = [];
    for (const endpoint of endpoints) {
        const result = await testEndpoint(endpoint.name, {
            method: endpoint.method,
            url: endpoint.url,
            data: endpoint.data
        });
        results.push(result);
    }

    return results;
}

function printResults(title, results) {
    console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
    console.log(`║  ${title.padEnd(68)}  ║`);
    console.log('╠════════════════════════════════════════════════════════════════════════╣');

    for (const result of results) {
        const statusIcon = result.status === 'OK' ? '[OK]' : '[FAIL]';
        const statusColor = result.status === 'OK' ? '\x1b[32m' : '\x1b[31m';
        const line = `${statusIcon} ${result.name.padEnd(20)} ${statusColor}${result.status.padEnd(8)}\x1b[0m ${result.responseTime}ms`;
        console.log(`║  ${line}`.padEnd(81) + '║');
        if (result.error) {
            console.log(`║     Error: ${result.error}`.padEnd(73) + '║');
        }
    }

    console.log('╚════════════════════════════════════════════════════════════════════════╝');
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║            CASCADING FAILURE DEMONSTRATION                             ║');
    console.log('║                                                                        ║');
    console.log('║  This test shows how a hub failure propagates through the system       ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝');

    // Phase 1: Test with everything running
    console.log('\n\nPHASE 1: Testing with all services running...');
    const phase1Results = await runHealthCheck();
    printResults('PHASE 1: All Services Running', phase1Results);

    // Phase 2: Stop RabbitMQ (secondary hub)
    console.log('\n\nPHASE 2: Stopping RabbitMQ (secondary hub)...');
    console.log('   Executing: docker-compose stop rabbitmq');

    await new Promise((resolve, reject) => {
        exec('docker-compose stop rabbitmq', { cwd: process.cwd().replace('/attack', '') }, (error) => {
            if (error) {
                console.log('   [!] Could not stop RabbitMQ automatically. Please run:');
                console.log('   docker-compose stop rabbitmq');
            }
            setTimeout(resolve, 3000);
        });
    });

    console.log('   Waiting for cascade effect...');
    await new Promise(r => setTimeout(r, 5000));

    const phase2Results = await runHealthCheck();
    printResults('PHASE 2: RabbitMQ Stopped (Hub Failure)', phase2Results);

    // Analysis
    console.log('\n\n═══════════════════════════════════════════════════════════════════════════');
    console.log('                        CASCADE FAILURE ANALYSIS                            ');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    const phase1Success = phase1Results.filter(r => r.status === 'OK').length;
    const phase2Success = phase2Results.filter(r => r.status === 'OK').length;

    console.log(`\n  Phase 1 (Normal):   ${phase1Success}/${phase1Results.length} endpoints working`);
    console.log(`  Phase 2 (Hub Down): ${phase2Success}/${phase2Results.length} endpoints working`);

    if (phase2Success < phase1Success) {
        console.log('\n  [!] CASCADING FAILURE DETECTED!');
        console.log('  When RabbitMQ (hub) fails, dependent services also fail.');
        console.log('\n  VULNERABILITY EXPLANATION:');
        console.log('  - No circuit breaker to isolate failures');
        console.log('  - No fallback mechanisms');
        console.log('  - Tight coupling through event bus');
        console.log('  - Hub dependency creates single point of failure');
    }

    // Phase 3: Restart RabbitMQ
    console.log('\n\nPHASE 3: Restarting RabbitMQ...');
    exec('docker-compose start rabbitmq', { cwd: process.cwd().replace('/attack', '') });

    console.log('\n  Test complete. Run "docker-compose start rabbitmq" to restore services.');
}

main().catch(console.error);
