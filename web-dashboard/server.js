const express = require('express');
const path = require('path');
const KVClient = require('../kvclient/KVClient.js');

const app = express();
const PORT = 3000;

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Store active clients per user
const activeClients = new Map();

async function getOrCreateClient(userId) {
  if (activeClients.has(userId)) {
    return activeClients.get(userId);
  }
  const client = new KVClient({ userId });
  await client.connect();
  activeClients.set(userId, client);
  return client;
}

// Telemetry API Endpoint
app.get('/api/telemetry/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const client = await getOrCreateClient(userId);
    let sysState = await client._getSysState();

    // Ensure state is parsed if returned as raw string
    if (typeof sysState === 'string') {
      sysState = JSON.parse(sysState);
    }

    res.json(sysState || { sys_metrics: {}, cache_metrics: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Web Dashboard running at: http://localhost:${PORT}`);
});