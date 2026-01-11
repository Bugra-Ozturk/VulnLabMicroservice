/**
 * Event Processor - RabbitMQ Consumer (Secondary Hub)
 * 
 * VULNERABILITIES:
 * 1. Single consumer - bottleneck
 * 2. Slow processing - causes queue buildup
 * 3. No dead letter queue - failed messages lost
 */

const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';

const QUEUES = ['auth-events', 'order-events', 'heavy-events'];

// Metrics
const metrics = {
    totalProcessed: 0,
    queueDepths: {},
    processingErrors: 0,
    avgProcessingTime: 0,
    startTime: Date.now()
};

async function start() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     EVENT PROCESSOR - RabbitMQ Consumer                    ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  VULNERABILITIES ACTIVE:                                   ║');
    console.log('║    - Single consumer (bottleneck)                          ║');
    console.log('║    - Slow processing simulation                            ║');
    console.log('║    - No dead letter queue                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    let connection;
    let retries = 0;
    const maxRetries = 10;

    // Retry connection with exponential backoff
    while (!connection && retries < maxRetries) {
        try {
            connection = await amqp.connect(RABBITMQ_URL);
            console.log('[EVENT PROCESSOR] Connected to RabbitMQ');
        } catch (err) {
            retries++;
            console.log(`[EVENT PROCESSOR] Connection failed, retry ${retries}/${maxRetries}...`);
            await new Promise(r => setTimeout(r, 2000 * retries));
        }
    }

    if (!connection) {
        console.error('[EVENT PROCESSOR] Failed to connect to RabbitMQ');
        process.exit(1);
    }

    const channel = await connection.createChannel();

    // VULNERABILITY: Low prefetch count causes slow processing
    await channel.prefetch(1);

    for (const queue of QUEUES) {
        await channel.assertQueue(queue, { durable: true });
        metrics.queueDepths[queue] = 0;

        channel.consume(queue, async (msg) => {
            if (msg) {
                const startTime = Date.now();

                try {
                    const content = JSON.parse(msg.content.toString());

                    // VULNERABILITY: Slow processing simulation
                    // This causes queue buildup under load
                    const processingTime = Math.random() * 500 + 200;
                    await new Promise(r => setTimeout(r, processingTime));

                    metrics.totalProcessed++;
                    const elapsed = Date.now() - startTime;
                    metrics.avgProcessingTime =
                        (metrics.avgProcessingTime * (metrics.totalProcessed - 1) + elapsed) /
                        metrics.totalProcessed;

                    console.log(`[${queue}] Processed: ${content.type} (${elapsed}ms)`);

                    channel.ack(msg);
                } catch (err) {
                    metrics.processingErrors++;
                    console.error(`[${queue}] Error processing message:`, err.message);
                    // VULNERABILITY: No dead letter queue - just nack
                    channel.nack(msg, false, false);
                }
            }
        });

        console.log(`[EVENT PROCESSOR] Listening on queue: ${queue}`);
    }

    // Print status every 5 seconds
    setInterval(async () => {
        for (const queue of QUEUES) {
            try {
                const queueInfo = await channel.checkQueue(queue);
                metrics.queueDepths[queue] = queueInfo.messageCount;
            } catch (e) { }
        }

        const totalQueueDepth = Object.values(metrics.queueDepths).reduce((a, b) => a + b, 0);

        if (totalQueueDepth > 10) {
            console.log(`\x1b[33m[WARNING] Queue backlog detected! Total messages: ${totalQueueDepth}\x1b[0m`);
        }
        if (totalQueueDepth > 50) {
            console.log(`\x1b[31m[CRITICAL] Queue overflow! Total messages: ${totalQueueDepth}\x1b[0m`);
        }
    }, 5000);
}

start().catch(console.error);
