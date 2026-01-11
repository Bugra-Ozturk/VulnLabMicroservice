/**
 * User Service - Depends on Gateway (Hub)
 * Simple user profile service for demonstration
 */

const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3003;

// Simple in-memory user store
const users = [
    { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin' },
    { id: 2, username: 'user1', email: 'user1@example.com', role: 'user' },
    { id: 3, username: 'user2', email: 'user2@example.com', role: 'user' }
];

// Metrics
const metrics = {
    usersRetrieved: 0,
    userLookups: 0
};

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'user-service', metrics });
});

app.get('/users', (req, res) => {
    metrics.usersRetrieved++;

    // Simulate processing delay
    setTimeout(() => {
        res.json(users);
    }, Math.random() * 50 + 25);
});

app.get('/users/:id', (req, res) => {
    metrics.userLookups++;
    const user = users.find(u => u.id === parseInt(req.params.id));

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.listen(PORT, () => {
    console.log(`[USER SERVICE] Running on port ${PORT}`);
});
