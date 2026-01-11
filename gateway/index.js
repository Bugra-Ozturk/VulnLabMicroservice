/**
 * API Gateway - VULNERABLE HUB COMPONENT
 * 
 * INTENTIONAL VULNERABILITIES:
 * 1. NO rate limiting - allows DoS attacks
 * 2. NO connection pooling - creates new RabbitMQ connection per request
 * 3. NO timeout configuration - requests can hang indefinitely
 * 4. NO circuit breaker - cascading failures propagate
 * 5. NO backpressure - accepts unlimited concurrent requests
 * 6. Memory leak - connections not properly closed
 */

const express = require('express');
const amqp = require('amqplib');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = 3000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3002';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3003';

// ============================================
// VULNERABILITY TRACKING (for demonstration)
// ============================================
const metrics = {
    totalRequests: 0,
    activeConnections: 0,
    peakConnections: 0,
    failedRequests: 0,
    rabbitConnections: 0,
    memoryUsageMB: 0,
    startTime: Date.now()
};

// Update memory usage every second
setInterval(() => {
    const used = process.memoryUsage();
    metrics.memoryUsageMB = Math.round(used.heapUsed / 1024 / 1024);
}, 1000);

// ============================================
// VULNERABLE MIDDLEWARE - No Rate Limiting!
// ============================================
app.use((req, res, next) => {
    metrics.totalRequests++;
    metrics.activeConnections++;

    if (metrics.activeConnections > metrics.peakConnections) {
        metrics.peakConnections = metrics.activeConnections;
    }

    // Log high load situations
    if (metrics.activeConnections > 50) {
        console.log(`\x1b[31m[WARNING] High load detected! Active connections: ${metrics.activeConnections}\x1b[0m`);
    }
    if (metrics.activeConnections > 100) {
        console.log(`\x1b[31m[CRITICAL] Gateway overloaded! Active connections: ${metrics.activeConnections}\x1b[0m`);
    }

    res.on('finish', () => {
        metrics.activeConnections--;
    });

    next();
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.round((Date.now() - metrics.startTime) / 1000),
        metrics: metrics
    });
});

// ============================================
// METRICS ENDPOINT (for monitoring)
// ============================================
app.get('/metrics', (req, res) => {
    const status = metrics.activeConnections > 100 ? 'OVERLOADED' :
        metrics.activeConnections > 50 ? 'DEGRADED' : 'HEALTHY';

    res.json({
        ...metrics,
        status: status,
        uptimeSeconds: Math.round((Date.now() - metrics.startTime) / 1000)
    });
});

// ============================================
// VULNERABLE: Create new RabbitMQ connection per request
// This is a RESOURCE EXHAUSTION vulnerability!
// ============================================
async function publishToQueue(queue, message) {
    // VULNERABILITY: Creating new connection for EACH request!
    // In production, you should use connection pooling
    const connection = await amqp.connect(RABBITMQ_URL);
    metrics.rabbitConnections++;

    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));

    // VULNERABILITY: Delayed cleanup causes connection buildup
    // Simulating "forgot to close connection" bug
    setTimeout(async () => {
        try {
            await channel.close();
            await connection.close();
            metrics.rabbitConnections--;
        } catch (e) {
            // Connection might already be closed
        }
    }, 5000); // 5 second delay before cleanup!

    return true;
}

// ============================================
// PROXY TO AUTH SERVICE
// ============================================
app.post('/api/auth/login', async (req, res) => {
    try {
        // VULNERABILITY: No timeout set!
        const response = await axios.post(`${AUTH_SERVICE_URL}/login`, req.body);

        // Publish event to RabbitMQ (vulnerable)
        await publishToQueue('auth-events', {
            type: 'LOGIN',
            timestamp: new Date().toISOString(),
            data: { user: req.body.username }
        });

        res.json(response.data);
    } catch (error) {
        metrics.failedRequests++;
        console.log(`\x1b[33m[ERROR] Auth service failed: ${error.message}\x1b[0m`);
        res.status(error.response?.status || 500).json({
            error: 'Auth service unavailable',
            details: error.message
        });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/register`, req.body);

        await publishToQueue('auth-events', {
            type: 'REGISTER',
            timestamp: new Date().toISOString(),
            data: { user: req.body.username }
        });

        res.json(response.data);
    } catch (error) {
        metrics.failedRequests++;
        res.status(error.response?.status || 500).json({
            error: 'Auth service unavailable'
        });
    }
});

// ============================================
// PROXY TO ORDER SERVICE
// ============================================
app.post('/api/orders', async (req, res) => {
    try {
        const response = await axios.post(`${ORDER_SERVICE_URL}/orders`, req.body);

        await publishToQueue('order-events', {
            type: 'ORDER_CREATED',
            timestamp: new Date().toISOString(),
            data: response.data
        });

        res.json(response.data);
    } catch (error) {
        metrics.failedRequests++;
        res.status(error.response?.status || 500).json({
            error: 'Order service unavailable'
        });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const response = await axios.get(`${ORDER_SERVICE_URL}/orders`);
        res.json(response.data);
    } catch (error) {
        metrics.failedRequests++;
        res.status(500).json({ error: 'Order service unavailable' });
    }
});

// ============================================
// PROXY TO USER SERVICE
// ============================================
app.get('/api/users', async (req, res) => {
    try {
        const response = await axios.get(`${USER_SERVICE_URL}/users`);
        res.json(response.data);
    } catch (error) {
        metrics.failedRequests++;
        res.status(500).json({ error: 'User service unavailable' });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const response = await axios.get(`${USER_SERVICE_URL}/users/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        metrics.failedRequests++;
        res.status(500).json({ error: 'User service unavailable' });
    }
});

// ============================================
// HEAVY ENDPOINT (for resource exhaustion demo)
// ============================================
app.post('/api/process-heavy', async (req, res) => {
    try {
        // VULNERABILITY: CPU-intensive operation without limits
        const iterations = req.body.iterations || 1000000;
        let result = 0;

        for (let i = 0; i < iterations; i++) {
            result += Math.sqrt(i) * Math.sin(i);
        }

        // Also publish to queue
        await publishToQueue('heavy-events', {
            type: 'HEAVY_PROCESS',
            timestamp: new Date().toISOString(),
            iterations: iterations,
            result: result
        });

        res.json({ result, iterations });
    } catch (error) {
        metrics.failedRequests++;
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     VULNERABLE API GATEWAY - Hub Component                 ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Port: ${PORT}                                                 ║`);
    console.log('║  Status: Running (with intentional vulnerabilities)        ║');
    console.log('║                                                            ║');
    console.log('║  VULNERABILITIES ACTIVE:                                   ║');
    console.log('║    - No rate limiting                                      ║');
    console.log('║    - No connection pooling                                 ║');
    console.log('║    - No circuit breaker                                    ║');
    console.log('║    - No timeout configuration                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
});
