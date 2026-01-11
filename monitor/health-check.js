/**
 * Real-time Health Check Monitor
 * 
 * Displays the current state of all services and 
 * highlights hub vulnerabilities in real-time.
 * 
 * Usage: node health-check.js
 */

const axios = require('axios');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

async function getGatewayMetrics() {
    try {
        const response = await axios.get(`${GATEWAY_URL}/metrics`, { timeout: 3000 });
        return response.data;
    } catch (error) {
        return null;
    }
}

async function checkService(name, url) {
    const startTime = Date.now();
    try {
        await axios.get(url, { timeout: 3000 });
        return { name, status: 'HEALTHY', responseTime: Date.now() - startTime };
    } catch (error) {
        return { name, status: 'DOWN', responseTime: Date.now() - startTime, error: error.code };
    }
}

function getStatusBar(value, max, width = 20) {
    const filled = Math.min(Math.floor((value / max) * width), width);
    const empty = width - filled;

    let color = '\x1b[32m'; // Green
    if (value / max > 0.5) color = '\x1b[33m'; // Yellow
    if (value / max > 0.8) color = '\x1b[31m'; // Red

    return color + '█'.repeat(filled) + '\x1b[90m' + '░'.repeat(empty) + '\x1b[0m';
}

async function displayDashboard() {
    console.clear();

    const metrics = await getGatewayMetrics();

    // Header
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    HUB VULNERABILITY MONITOR                                 ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  Time: ${new Date().toLocaleTimeString().padEnd(68)}  ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

    // API Gateway (Main Hub)
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║  📍 API GATEWAY (PRIMARY HUB)                                                ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    if (metrics) {
        const connBar = getStatusBar(metrics.activeConnections, 200);
        const memBar = getStatusBar(metrics.memoryUsageMB, 512);
        const rabbitBar = getStatusBar(metrics.rabbitConnections, 100);

        // Status determination
        let status = 'HEALTHY';
        let statusColor = '\x1b[32m';

        if (metrics.status === 'DEGRADED') {
            status = 'DEGRADED';
            statusColor = '\x1b[33m';
        } else if (metrics.status === 'OVERLOADED') {
            status = 'OVERLOADED';
            statusColor = '\x1b[31m';
        }

        console.log(`║  Status: ${statusColor}${status}\x1b[0m`.padEnd(88) + '║');
        console.log('║                                                                              ║');
        console.log(`║  Active Connections:    [${connBar}] ${metrics.activeConnections.toString().padStart(5)}/200`.padEnd(82) + '║');
        console.log(`║  Memory Usage (MB):     [${memBar}] ${metrics.memoryUsageMB.toString().padStart(5)}/512`.padEnd(82) + '║');
        console.log(`║  RabbitMQ Connections:  [${rabbitBar}] ${metrics.rabbitConnections.toString().padStart(5)}/100`.padEnd(82) + '║');
        console.log('║                                                                              ║');
        console.log(`║  Total Requests:  ${metrics.totalRequests.toString().padEnd(15)} Failed: ${metrics.failedRequests.toString().padEnd(15)}`.padEnd(79) + '║');
        console.log(`║  Peak Connections: ${metrics.peakConnections.toString().padEnd(14)} Uptime: ${metrics.uptimeSeconds}s`.padEnd(79) + '║');

        // Vulnerability warnings
        if (metrics.activeConnections > 50) {
            console.log('║                                                                              ║');
            console.log('║  \x1b[33m[!] HIGH LOAD: No rate limiting is protecting the gateway!\x1b[0m               ║');
        }
        if (metrics.rabbitConnections > 20) {
            console.log('║  \x1b[33m[!] CONNECTION LEAK: RabbitMQ connections not being pooled!\x1b[0m              ║');
        }
        if (metrics.memoryUsageMB > 200) {
            console.log('║  \x1b[31m[X] MEMORY EXHAUSTION: Approaching container limits!\x1b[0m                      ║');
        }
    } else {
        console.log('║  Status: \x1b[31m[X] UNREACHABLE\x1b[0m                                                     ║');
        console.log('║                                                                              ║');
        console.log('║  \x1b[31mThe API Gateway hub is not responding!\x1b[0m                                     ║');
        console.log('║  \x1b[31mAll downstream services are inaccessible.\x1b[0m                                  ║');
    }

    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

    // Downstream Services
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║   DOWNSTREAM SERVICES (Dependent on Hub)                                     ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    const services = [
        { name: 'Auth Service', endpoint: '/api/auth/login', method: 'POST', data: { username: 'test', password: 'test' } },
        { name: 'Order Service', endpoint: '/api/orders' },
        { name: 'User Service', endpoint: '/api/users' }
    ];

    for (const service of services) {
        try {
            const startTime = Date.now();
            if (service.method === 'POST') {
                await axios.post(`${GATEWAY_URL}${service.endpoint}`, service.data, { timeout: 3000 });
            } else {
                await axios.get(`${GATEWAY_URL}${service.endpoint}`, { timeout: 3000 });
            }
            const elapsed = Date.now() - startTime;

            let timeColor = '\x1b[32m';
            if (elapsed > 500) timeColor = '\x1b[33m';
            if (elapsed > 1000) timeColor = '\x1b[31m';

            console.log(`║  [OK] ${service.name.padEnd(20)} ${timeColor}${elapsed}ms\x1b[0m`.padEnd(88) + '║');
        } catch (error) {
            console.log(`║  [X] ${service.name.padEnd(20)} \x1b[31mUNREACHABLE\x1b[0m (cascading failure)`.padEnd(88) + '║');
        }
    }

    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

    // Graph Analysis Summary
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║   GRAPH ANALYSIS SUMMARY                                                     ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log('║                                                                              ║');
    console.log('║  Hub Components (High Degree):                                               ║');
    console.log('║    • API Gateway     In-Degree: 4  Out-Degree: 3  Total: 7 [!] HUB           ║');
    console.log('║    • RabbitMQ        In-Degree: 3  Out-Degree: 1  Total: 4 [!] HUB           ║');
    console.log('║                                                                              ║');
    console.log('║  Risk Assessment:                                                            ║');
    console.log('║    • Scale-Free Structure: YES (power-law degree distribution)               ║');
    console.log('║    • Single Points of Failure: 2 identified                                  ║');
    console.log('║    • Cascading Failure Risk: HIGH                                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

    console.log('\n  Press Ctrl+C to exit');
    console.log('  Refreshing every 2 seconds...');
}

// Main loop
async function main() {
    console.log('Starting Hub Vulnerability Monitor...\n');

    // Initial display
    await displayDashboard();

    // Update every 2 seconds
    setInterval(displayDashboard, 2000);
}

main().catch(console.error);
