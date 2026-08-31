const net = require('net');
const LRUCache = require('./lru.js');
const cache = new LRUCache();

// Core metrics tracking object (will stream this to monitor server later)
const metrics = {
    totalCommands: 0,
    activeConnections: 0,
    connectedAt: new Date().toISOString()
};

// Placeholder in-memory storage map
const dbMemory = new Map();

/**
 * Command Router Matrix
 * Processes valid extracted commands and sends formatted byte strings back to client.
 */
function handleDatabaseCommand(socket, payload) {
    metrics.totalCommands++;
    
    // Clean string formatting and argument tokenization
    const tokens = payload.trim().split('|');
    const command = tokens[0].toUpperCase();
    const key = tokens[1];
    const value = tokens[2];

    if (!command) return;

    switch (command) {
        case 'SET':
            if (!key || !value) {
                socket.write('ERR: SET requires both key and value components\n');
                return;
            }
            // dbMemory.set(key, value);
            cache.insert(key, value);
            socket.write('OK\n');
            break;

        case 'GET':
            if (!key) {
                socket.write('ERR: GET requires a valid key component\n');
                return;
            }
            const res = cache.getVal(key);
            if (res != undefined) {
                socket.write(`VALUE|${res}\n`);
            } else {
                socket.write('ERR: KEY_NOT_FOUND\n');
            }
            break;

        case 'DEL':
            if (!key) {
                socket.write('ERR: DEL requires a valid key component\n');
                return;
            }
            const flag = cache.remove(key);
            if (flag !== undefined) {
                socket.write('OK\n');
            } else {
                socket.write('ERR: KEY_NOT_FOUND\n');
            }
            break;

        default:
            socket.write(`ERR: UNKNOWN_COMMAND_ERR [${command}]\n`);
            break;
    }
}

// Instantiate the Core TCP Engine
const server = net.createServer((socket) => {
    metrics.activeConnections++;
    console.log(`[Engine Connected] Sockets Active: ${metrics.activeConnections}`);

    // Buffer to handle stream aggregation (crucial for network fragmentation stability)
    let dynamicBuffer = '';

    socket.on('data', (chunk) => {
        // Append incoming byte chunk casted to UTF-8 text string
        dynamicBuffer += chunk.toString('utf8');
        console.log(`Dynamic buffer : ${dynamicBuffer}`);

        // Extract and execute full instruction sets split by delimiter
        let newlineIndex;
        while ((newlineIndex = dynamicBuffer.indexOf('\n')) !== -1) {
            const completeCommandFrame = dynamicBuffer.substring(0, newlineIndex);
            dynamicBuffer = dynamicBuffer.substring(newlineIndex + 1);
            
            // Route extracted instruction line to internal parsing engines
            handleDatabaseCommand(socket, completeCommandFrame);
        }
    });

    socket.on('end', () => {
        metrics.activeConnections--;
        console.log(`[Engine Disconnected] Sockets Active: ${metrics.activeConnections}`);
    });

    socket.on('error', (err) => {
        console.error('[Socket Exception Overhead Handler]:', err.message);
    });
});

// Expose Core Database Engine to default custom port 6379
const ENGINE_PORT = 6379;
server.listen(ENGINE_PORT, () => {
    console.log(`🚀 KV-Engine operational on isolated TCP loopback port :${ENGINE_PORT}`);
});
