/**
 * Auth Service - Depends on Gateway (Hub)
 * Simple authentication service for demonstration
 */

const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3001;

// Simple in-memory user store
const users = new Map();
users.set('admin', { password: 'admin123', role: 'admin' });
users.set('user1', { password: 'user123', role: 'user' });

// Metrics for monitoring
const metrics = {
    loginAttempts: 0,
    successfulLogins: 0,
    failedLogins: 0,
    registrations: 0
};

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'auth-service', metrics });
});

app.post('/login', (req, res) => {
    metrics.loginAttempts++;
    const { username, password } = req.body;

    // Simulate processing delay
    const delay = Math.random() * 100 + 50;

    setTimeout(() => {
        const user = users.get(username);

        if (user && user.password === password) {
            metrics.successfulLogins++;
            console.log(`[AUTH] Login successful: ${username}`);
            res.json({
                success: true,
                token: `token_${username}_${Date.now()}`,
                user: { username, role: user.role }
            });
        } else {
            metrics.failedLogins++;
            console.log(`[AUTH] Login failed: ${username}`);
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
    }, delay);
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;

    if (users.has(username)) {
        return res.status(400).json({
            success: false,
            error: 'Username already exists'
        });
    }

    users.set(username, { password, role: 'user' });
    metrics.registrations++;
    console.log(`[AUTH] User registered: ${username}`);

    res.json({
        success: true,
        message: 'User registered successfully'
    });
});

app.listen(PORT, () => {
    console.log(`[AUTH SERVICE] Running on port ${PORT}`);
});
