const net = require('net');
const connections = require('./init/connections.js');
const aofLogger = require('./aof_logger_engine.js');
const loggerEngine = new aofLogger();
const bootstrap = require('./aof_bootstrap.js');

let activeConnections = 0;

/*
    Command Router Matrix
 */
function handleDatabaseCommand(socket, payload) {

  const tokens = payload.trim().split('|');
  const command = tokens[0].toUpperCase();

  if (!command) return;

  // Authentication Guard
  if (!socket.userID && command !== 'AUTH' && command !== 'INIT') {
    socket.write('ERR: UNAUTHENTICATED!! Please run AUTH|user_id and authenticate first.\n');
    return;
  }

  switch (command) {
    /* Initialize a fresh user with a UUID */
    case 'INIT': {
      const userID = connections.createUser();
      socket.write(`UUID|${userID}\n`);
      break;
    }

    /* Authorize a user for data operations */
    case 'AUTH': {
      const authKey = tokens[1];
      if (!authKey) {
        socket.write('ERR: AUTH Requires a user_id.\n');
        return;
      }
      if (connections.verifyUser(authKey)) {
        socket.userID = authKey;
        loggerEngine.log(authKey, ""); 
        socket.write('SUCCESS: User authorized.\n');
      } else {
        socket.write('ERR: Invalid user id, please run get signup and get a userID before continuing.\n');
      }
      break;
    }

    /* CREATE a completely new cache instance for current user -> returns cache id */
    case 'CREATE': {
      const newCacheID = connections.createCache(socket.userID);
      loggerEngine.log(socket.userID, `CREATE|${newCacheID}`);
      socket.write(`CACHE_ID|${newCacheID}\n`);
      break;
    }


    /*
        DATA Operations (updated) <command>|<cacheID>|<agr1>|<arg2>|<arg3>
    */
    /* SET syntax: SET|cacheID|key|value|[ttl] */
    case 'SET': {
      const targetCacheID = tokens[1];
      const key = tokens[2];
      const value = tokens[3];
      const ttl = tokens[4];

      const cacheInstance = connections.getCache(socket.userID, targetCacheID);
      if (!cacheInstance) {
        socket.write('ERR: INVALID_CACHE_ID\n');
        return;
      }
      if (!key || !value) {
        socket.write('ERR: SET requires both key and value components\n');
        return;
      }

      if (ttl !== undefined && ttl.trim() !== '') {
        const parsedTTL = parseInt(ttl, 10);
        if (!isNaN(parsedTTL)) {
          cacheInstance.insert(key, value, parsedTTL);
          loggerEngine.log(socket.userID, `SET|${targetCacheID}|${key}|${value}|${parsedTTL}`);
        } else {
          socket.write('ERR: TTL must be an integer\n');
          return;
        }
      } else {
        cacheInstance.insert(key, value);
        loggerEngine.log(socket.userID, `SET|${targetCacheID}|${key}|${value}`);
      }
      socket.write('OK\n');
      break;
    }

    /* GET syntax: GET|cacheID|key */
    case 'GET': {
      const targetCacheID = tokens[1];
      const key = tokens[2];

      const cacheInstance = connections.getCache(socket.userID, targetCacheID);
      if (!cacheInstance) {
        socket.write('ERR: INVALID_CACHE_ID\n');
        return;
      }
      if (!key) {
        socket.write('ERR: GET requires a valid key.\n');
        return;
      }

      const res = cacheInstance.getVal(key);
      if (res != null) {
        socket.write(`VALUE|${res}\n`);
      } else {
        socket.write('ERR: KEY Not found.\n');
      }
      break;
    }

    /* DEL syntax: DEL|cacheID|key */
    case 'DEL': {
      const targetCacheID = tokens[1];
      const key = tokens[2];

      const cacheInstance = connections.getCache(socket.userID, targetCacheID);
      if (!cacheInstance) {
        socket.write('ERR: INVALID_CACHE_ID\n');
        return;
      }
      if (!key) {
        socket.write('ERR: DEL requires a valid key component\n');
        return;
      }

      const flag = cacheInstance.remove(key);
      if (flag !== false) {
        socket.write('OK\n');
        loggerEngine.log(socket.userID, `DEL|${targetCacheID}|${key}`);
      } else {
        socket.write('ERR: KEY_NOT_FOUND\n');
      }
      break;
    }

    /* STATS syntax: STATS|cacheID */
    case 'STATS': {
      const targetCacheID = tokens[1];

      const cacheInstance = connections.getCache(socket.userID, targetCacheID);
      if (!cacheInstance) {
        socket.write('ERR: INVALID_CACHE_ID\n');
        return;
      }

      const status = cacheInstance.stats();
      socket.write(`STATS|${JSON.stringify(status)}\n`);
      break;
    }

    default: {
      socket.write(`ERR: UNKNOWN_COMMAND_ERR [${command}]\n`);
      break;
    }
  }
}

// tcp server
const server = net.createServer((socket) => {
  socket.userID = null;
  console.log(`[Engine Connected] Sockets Active: ${activeConnections}`);
  
  //  fragmentation handling
  let dynamicBuffer = '';
  socket.on('data', (chunk) => {
    dynamicBuffer += chunk.toString('utf8');
    
    let newlineIndex;
    while ((newlineIndex = dynamicBuffer.indexOf('\n')) !== -1) {
      const completeCommandFrame = dynamicBuffer.substring(0, newlineIndex);
      dynamicBuffer = dynamicBuffer.substring(newlineIndex + 1);
      handleDatabaseCommand(socket, completeCommandFrame);
    }
  });

  socket.on('end', () => {
    activeConnections--;
    console.log(`[Engine Disconnected] Sockets Active: ${activeConnections}`);
  });

  socket.on('error', (err) => {
    console.error('[Socket Exception Overhead Handler]:', err.message);
  });
});

const ENGINE_PORT = 6379;
async function stateServer() {
  try {
    console.log('Initializing aol based rehydration...');
    await bootstrap();
    server.listen(ENGINE_PORT, () => {
      console.log(`🚀 KV-Engine operational on isolated TCP loopback port :${ENGINE_PORT}`);
    });
  } catch (error) {
    console.error('Critical failure, couldn\'t start server.', error);
    process.exit(1);
  }
}
stateServer();
