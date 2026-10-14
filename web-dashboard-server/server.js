const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws'); 
const KVClient = require('../kvclient/KVClient.js'); 

const app = express();
const PORT = 3000;

// Serve static frontend compiled application files from the Svelte workspace distribution folder
app.use(express.static(path.join(__dirname, '../web-dashboard/dist')));

// Track active client socket pairings and active visual monitoring counts per user
const activeClients = new Map();

async function acquireClient(userId, onUnexpectedDisconnect) {
  if (activeClients.has(userId)) {
    const entry = activeClients.get(userId);
    entry.refCount++;
    return entry.client;
  }

  // Instantiate your native net module-based client
  const client = new KVClient({ userId });
  await client.connect();

  // Guard rails if the raw underlying database TCP socket closes unexpectedly
  if (client.client) {
    client.client.on('close', () => {
      onUnexpectedDisconnect(userId);
    });
  }

  activeClients.set(userId, { client, refCount: 1 });
  return client;
}

function releaseClient(userId) {
  if (!activeClients.has(userId)) return;
  
  const entry = activeClients.get(userId);
  entry.refCount--;

  // If no more open browser tabs are tracking this specific user, close the TCP link completely to free memory
  if (entry.refCount <= 0) {
    entry.client.disconnect();
    activeClients.delete(userId);
    console.log(`🧹 Safely cleaned up native TCP resources for user: ${userId}`);
  }
}

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/dist/index.html'));
});

// Bind basic HTTP router app listener 
const server = app.listen(PORT, () => {
  console.log(`🌐 Web Dashboard server running at: http://localhost:${PORT}`);
});

// Initialize a headless WebSocket contextual instance
const wss = new WebSocketServer({ noServer: true });

// Route and manage raw browser upgrade protocol requests safely
server.on('upgrade', (request, socket, head) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = parsedUrl.pathname;
  
  console.log(`✉️ Incoming upgrade packet request for: ${pathname}`);

  if (pathname === '/api/telemetry/stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    console.warn(`❌ Rejected socket routing connection upgrade request for: ${pathname}`);
    socket.destroy();
  }
});

// Establish active websocket state connections
wss.on('connection', (ws) => {
  let pollingInterval = null;
  let targetUser = null;

  // Clean crash fallback handler if the underlying storage layer snaps
  const handleServerCrash = (userId) => {
    console.error(`🚨 Core TCP server connection broke down for user: ${userId}`);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ error: "Underlying TCP core storage node disconnected unexpectedly." }));
      ws.close();
    }
  };

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message);
      
      if (payload.type === 'SUBSCRIBE') {
        targetUser = payload.userId;
        console.log(`📡 Dashboard tab subscribed to telemetry data for user: ${targetUser}`);
        
        // Safe database engine connection acquisition pipeline
        const client = await acquireClient(targetUser, handleServerCrash).catch(err => {
          throw new Error(`TCP Connection Engine Refused Link: ${err.message}`);
        });

        if (pollingInterval) clearInterval(pollingInterval);

        // Standard 1-second telemetry state aggregation routing loop
        pollingInterval = setInterval(async () => {
          try {
            let sysState = await client._getSysState();
            if (typeof sysState === 'string') {
              sysState = JSON.parse(sysState);
            }
            
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify(sysState || { sys_metrics: {}, cache_metrics: [] }));
            }
          } catch (err) {
            console.error(`Failed to process metrics update string for ${targetUser}:`, err.message);
          }
        }, 1000);
      }
    } catch (err) {
      console.error(`🚨 WebSocket Thread Exception Encountered:`, err.message);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ error: err.message }));
        ws.close();
      }
    }
  });

  // Resource extraction safety garbage collection hook
  ws.on('close', () => {
    console.log(`🔌 Dashboard browser tab closed connection.`);
    if (pollingInterval) clearInterval(pollingInterval);
    if (targetUser) {
      releaseClient(targetUser);
    }
  });
});
