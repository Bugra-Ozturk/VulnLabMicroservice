/**
 * Order Service - Depends on Gateway (Hub)
 * Simple order management service for demonstration
 */

const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3002;

// Simple in-memory order store
const orders = [];
let orderIdCounter = 1;

// Metrics
const metrics = {
    ordersCreated: 0,
    ordersRetrieved: 0
};

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'order-service', metrics });
});

app.get('/orders', (req, res) => {
    metrics.ordersRetrieved++;
    res.json(orders);
});

app.post('/orders', (req, res) => {
    const { product, quantity, userId } = req.body;

    // Simulate processing delay
    const delay = Math.random() * 200 + 100;

    setTimeout(() => {
        const order = {
            id: orderIdCounter++,
            product: product || 'Unknown Product',
            quantity: quantity || 1,
            userId: userId || 'anonymous',
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        orders.push(order);
        metrics.ordersCreated++;
        console.log(`[ORDER] Order created: #${order.id}`);

        res.status(201).json(order);
    }, delay);
});

app.get('/orders/:id', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (order) {
        res.json(order);
    } else {
        res.status(404).json({ error: 'Order not found' });
    }
});

app.listen(PORT, () => {
    console.log(`[ORDER SERVICE] Running on port ${PORT}`);
});
