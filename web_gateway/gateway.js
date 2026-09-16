const express = require('express');
const path = require('path');
const KVClient = require('../engine/lib/KVClient.js'); // Your custom closure client

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache instances pool to reuse connected sockets per active developer
const clientPool = new Map();

// 💾 IN-MEMORY RATE LIMIT TRACKER MATRICES
const rateLimits = {
    MAX_REQUESTS_PER_WINDOW: 20, // Strict call volume threshold
    WINDOW_MS: 60 * 1000         // 1 minute tracking window
};
const userRequestMetrics = new Map(); // structure: Map(userId => Array[timestamps])

/**
 * 🛡️ Dynamic Multi-Tenant Limiter Middleware
 */
function enforceTenantBoundaries(req, res, next) {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) {
        return res.status(400).json({ error: "Missing required 'X-User-ID' identity header." });
    }

    const now = Date.now();
    if (!userRequestMetrics.has(userId)) {
        userRequestMetrics.set(userId, []);
    }

    let timestamps = userRequestMetrics.get(userId);
    // Evict old metrics data tracking points from outside the current rolling window slice
    timestamps = timestamps.filter(time => now - time < rateLimits.WINDOW_MS);
    userRequestMetrics.set(userId, timestamps);

    if (timestamps.length >= rateLimits.MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({ 
            error: `API Rate Limit Exceeded. Max operations cap (${rateLimits.MAX_REQUESTS_PER_WINDOW}/min) reached.` 
        });
    }

    // Log this request timestamp
    timestamps.push(now);
    next();
}

/**
 * Helper to fetch or provision a connected socket wrapper context from the proxy pool
 */
async function getPooledClient(userId) {
    if (clientPool.has(userId)) {
        return clientPool.get(userId);
    }
    const db = new KVClient({ userId });
    await db.connect();
    clientPool.set(userId, db);
    return db;
}

// ==========================================
// 🛣️ REST ENDPOINTS
// ==========================================

// SIGNUP: Bootstrap a new developer profile over raw TCP
app.post('/api/signup', async (req, res) => {
    try {
        // Direct non-auth connection to execute INIT setup
        const tempClient = new KVClient({ userId: 'INIT_MOCK' });
        
        // Emulate standalone command routing context to fire pure INIT frame
        const bootstrapper = new (require('net').Socket)();
        bootstrapper.connect(6379, '127.0.0.1', () => {
            bootstrapper.write('INIT\n');
        });

        bootstrapper.on('data', (data) => {
            const raw = data.toString().trim();
            // Expected: "UUID|generated-uuid."
            const userId = raw.replace('UUID|', '').replace('.', '');
            bootstrapper.end();
            return res.json({ userId });
        });
    } catch (err) {
        res.status(500).json({ error: "TCP Engine Handshake Error during initialization." });
    }
});

// CREATE SCOPED CACHE
app.post('/api/cache', enforceTenantBoundaries, async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const db = await getPooledClient(userId);
        const cacheInstance = await db.createCache();
        res.json({ cacheId: cacheInstance.cacheId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROUTE DATA (SET COMPONENT)
app.post('/api/data', enforceTenantBoundaries, async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { cacheId, key, value, ttl } = req.body;

        if (!cacheId || !key || !value) {
            return res.status(400).json({ error: "Parameters missing: cacheId, key, and value required." });
        }

        const db = await getPooledClient(userId);
        // Emulate the scoped structure manually using direct command evaluation
        const payload = ttl ? `SET|${cacheId}|${key}|${value}|${ttl}` : `SET|${cacheId}|${key}|${value}`;
        const status = await db._sendCommand(payload);
        
        res.json({ status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROUTE DATA (GET COMPONENT)
app.get('/api/data', enforceTenantBoundaries, async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { cacheId, key } = req.query;

        if (!cacheId || !key) {
            return res.status(400).json({ error: "Parameters missing: cacheId and key required." });
        }

        const db = await getPooledClient(userId);
        const rawResponse = await db._sendCommand(`GET|${cacheId}|${key}`);
        
        if (rawResponse.startsWith("VALUE|")) {
            res.json({ value: rawResponse.substring(6) });
        } else {
            res.json({ value: null, status: rawResponse });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log('🚀 Gateway Web Server up on http://127.0.0.1:3000');
});
