const net = require('net');
const connections = require('./init/connections.js')
const aofLogger = require('./aof_logger_engine.js')
const loggerEngine = new aofLogger();
const bootstrap = require('./aof_bootstrap.js');

// Core metrics tracking object (tracks metrics only after the last boot)
const metrics = {
    totalCommands: 0,
    activeConnections: 0,
    connectedAt: new Date().toISOString()
};


/**
 * Command Router Matrix
 * Processes valid extracted commands and sends formatted byte strings back to client.
 */
function handleDatabaseCommand(socket, payload) {
    metrics.totalCommands++;
    
    const tokens = payload.trim().split('|');
    const command = tokens[0].toUpperCase();
    const key = tokens[1];
    const value = tokens[2];
    const ttl = tokens[3];

    if (!command) return;

    if(!socket.cache && command !== 'AUTH' && command !== 'INIT'){
        socket.write('ERR: UNAUTHENTICATED!! Please run AUTH|user_id first.');
        return;
    }

    switch (command) {
        case 'INIT':
            const userID = connections.createUser();
            socket.write(`UUID | ${userID}.\n`);
            // socket.write('OK\n');
            break;
        case 'AUTH': 
            if(!key){
                socket.write('ERR: AUTH Requires a key.\n');
                return;
            }

            if(connections.verifyUser(key)){
                socket.cache = connections.getCache(key);
                socket.userID = key;
                socket.write('SUCCESS: Intialized a memory block. \n');
            }else{
                socket.write('ERR: Invalid user id, please run get signup and get a userID before continuing.\n');
            }
            socket.write('OK\n');
        break;
        case 'SET':
            if (!key || !value) {
                socket.write('ERR: SET requires both key and value components\n');
                return;
            }
            if(ttl !== undefined && ttl.trim() !== ''){
                const parsedTTL = parseInt(ttl, 10);
                if(!isNaN(parsedTTL)){
                    console.log("calling insert by putting a ttl\n");
                    console.log("TTL value : ", parsedTTL)


                    socket.cache.insert(key, value, parsedTTL);


                    loggerEngine.log(socket.userID, `SET|${key}|${value}|${parsedTTL}`);
                }else{
                    socket.write("ERR: TTL must be an integer\n");
                }
            }else{
                socket.cache.insert(key, value);
                loggerEngine.log(socket.userID, `SET|${key}|${value}`)
            }
            socket.write("OK\n");
            break;

        case 'GET':
            if (!key) {
                socket.write('ERR: GET requires a valid key.\n');
                return;
            }
            const res = socket.cache.getVal(key);
            if (res != null) {
                socket.write(`VALUE|${res}\n`);
            } else {
                socket.write('ERR: KEY Not found.\n');
            }
            break;

        case 'DEL':
            if (!key) {
                socket.write('ERR: DEL requires a valid key component\n');
                return;
            }
            const flag = socket.cache.remove(key);
            if (flag !== false) {
                socket.write('OK\n');


                loggerEngine.log(socket.userID, `DEL|${key}`);
            } else {
                socket.write('ERR: KEY_NOT_FOUND\n');
            }
            break;

        case 'STATS':
            const status = socket.cache.stats();
            socket.write(`OK|${JSON.stringify(status)}\n`);
            break;

        default:
            socket.write(`ERR: UNKNOWN_COMMAND_ERR [${command}]\n`);
            break;
    }
}

// Instantiate the Core TCP Engine
const server = net.createServer((socket) => {
    socket.userID = null;
    socket.cache = null;

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

async function stateServer() {
    try {
        console.log("Initializing aol based rehydration...");

        await bootstrap();

        server.listen(ENGINE_PORT, () => {
            console.log(`🚀 KV-Engine operational on isolated TCP loopback port :${ENGINE_PORT}`);
        });
    }catch(error){
        console.error("Critical failure, couldn't start server.", error);
        process.exit(1);
    }
}

stateServer();

