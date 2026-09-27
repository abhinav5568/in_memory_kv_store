const net = require("net");
const connections = require("./init/connections.js");
const aofLogger = require("./aof_logger_engine.js");
const loggerEngine = new aofLogger();
const bootstrap = require("./aof_bootstrap.js");

/*
    Command Router Matrix
 */
function handleDatabaseCommand(socket, payload) {
  const tokens = payload.trim().split("|");
  const command = tokens[0].toUpperCase();

  if (!command) return;

  // INIT guard (must initialize userID in memory before running read write operations)
  if (!socket.userID && command !== "INIT") {
    socket.write("ERR: User not found !! Please run INIT first.\n");
    return;
  }

  switch (command) {
    /* 
      Initialize a tenant namespace in the memory 
     */
    case "INIT": {
      const userID = tokens[1];
      if (!userID) {
        socket.write("ERR: INIT Requires a user_id.\n");
        return;
      }
      // if (connections.initializeUser(authKey)) {
      //   socket.userID = authKey;
      //   loggerEngine.log(authKey, "");
      //   socket.write('SUCCESS: User authorized.\n');
      // } else {
      //   socket.write('ERR: Invalid user id, please run get signup and get a userID before continuing.\n');
      // }
      if (typeof userID != "string") {
        socket.write("ERR: INIT Requires input of data type string.\n");
      }
      if (connections.initializeUser(userID)) {
        socket.userID = userID;
        socket.write("SUCCESS: User initialized.\n");
      } else {
        socket.write("ERR: Failed to initialize user.\n");
      }
      break;
    }

    /* CREATE a completely new cache instance for current namespace -> returns cache id */
    case "CREATE": {
      const newCacheID = connections.createCache(socket.userID);
      loggerEngine.log(socket.userID, `CREATE|${newCacheID}`);
      socket.write(`CACHE_ID|${newCacheID}\n`);
      break;
    }

    /*
        DATA Operations <command>|<cacheID>|<agr1>|<arg2>|<arg3>
    */

    /* SET syntax: SET|cacheID|key|value|[ttl] */
    case "SET": {
      const targetCacheID = tokens[1];
      const key = tokens[2];
      const value = tokens[3];
      const ttl = tokens[4];

      const cacheInstance = connections.getCache(socket.userID, targetCacheID);
      if (!cacheInstance) {
        socket.write("INVALID_CACHE_ID\n");
        return;
      }
      if (!key || !value) {
        socket.write("SET requires both key and value components\n");
        return;
      }

      if (ttl !== undefined && ttl.trim() !== "") {
        const parsedTTL = parseInt(ttl, 10);
        if (!isNaN(parsedTTL)) {
          cacheInstance.insert(key, value, parsedTTL);
          loggerEngine.log(
            socket.userID,
            `SET|${targetCacheID}|${key}|${value}|${parsedTTL}`,
          );
        } else {
          socket.write("TTL must be an integer\n");
          return;
        }
      } else {
        cacheInstance.insert(key, value);
        loggerEngine.log(socket.userID, `SET|${targetCacheID}|${key}|${value}`);
      }
      socket.write("OK\n");
      break;
    }

    /* GET syntax: GET|cacheID|key */
    case "GET": {
      const targetCacheID = tokens[1];
      const key = tokens[2];

      const cacheInstance = connections.getCache(socket.userID, targetCacheID);
      if (!cacheInstance) {
        socket.write("INVALID_CACHE_ID!\n");
        return;
      }
      if (!key) {
        socket.write("GET requires a valid key!!\n");
        return;
      }

      const res = cacheInstance.getVal(key);
      if (res != null) {
        socket.write(`VALUE|${res}\n`);
      } else {
        socket.write("KEY Not found!!\n");
      }
      break;
    }

    /* DEL syntax: DEL|cacheID|key */
    case "DEL": {
      const targetCacheID = tokens[1];
      const key = tokens[2];

      const cacheInstance = connections.getCache(socket.userID, targetCacheID);
      if (!cacheInstance) {
        socket.write("INVALID_CACHE_ID\n");
        return;
      }
      if (!key) {
        socket.write("DEL requires a valid key component\n");
        return;
      }

      const flag = cacheInstance.remove(key);
      if (flag !== false) {
        socket.write("OK\n");
        loggerEngine.log(socket.userID, `DEL|${targetCacheID}|${key}`);
      } else {
        socket.write("KEY_NOT_FOUND\n");
      }
      break;
    }

    /* STATS syntax: STATS|cacheID */
    case "STATS": {
      const targetCacheID = tokens[1];

      const cacheInstance = connections.getCache(socket.userID, targetCacheID);
      if (!cacheInstance) {
        socket.write("INVALID_CACHE_ID\n");
        return;
      }

      const status = cacheInstance.stats();
      socket.write(`STATS|${JSON.stringify(status)}\n`);
      break;
    }

    case 'SYS_STATE': {
        const cacheStats = connections.getAllCacheStates(socket.userID);
        
        if (!cacheStats) {
            socket.write('USER_NOT_FOUND\n');
            return;
        }

        const memory = process.memoryUsage();

        server.getConnections((err, connectionCount) => {
            const masterPayload = {
                sys_metrics: {
                    uptime_seconds: Math.floor(process.uptime()),
                    active_connections: connectionCount,
                    heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024)
                },
                cache_metrics: cacheStats
            };

            socket.write(`SYS_STATE|${JSON.stringify(masterPayload)}\n`);
        });
        break;
    }

    default: {
      socket.write(`UNKNOWN_COMMAND_ERR [${command}]\n`);
      break;
    }
  }
}

// tcp server
const server = net.createServer((socket) => {
  socket.userID = null;
  console.log(`[Engine Connected].`);

  //  fragmentation handling
  let dynamicBuffer = "";
  socket.on("data", (chunk) => {
    dynamicBuffer += chunk.toString("utf8");

    let newlineIndex;
    while ((newlineIndex = dynamicBuffer.indexOf("\n")) !== -1) {
      const completeCommandFrame = dynamicBuffer.substring(0, newlineIndex);
      dynamicBuffer = dynamicBuffer.substring(newlineIndex + 1);
      handleDatabaseCommand(socket, completeCommandFrame);
    }
  });

  socket.on("end", () => {
    console.log(`[Engine Disconnected].`);
  });

  socket.on("error", (err) => {
    console.error("[Socket Exception Overhead Handler]:", err.message);
  });
});

const ENGINE_PORT = 6379;
async function stateServer() {
  try {
    console.log("Initializing aol based rehydration...");
    await bootstrap();
    server.listen(ENGINE_PORT, () => {
      console.log(
        `🚀 KV-Engine operational on isolated TCP loopback port :${ENGINE_PORT}`,
      );
    });
  } catch (error) {
    console.error("Critical failure, couldn't start server.", error);
    process.exit(1);
  }
}
stateServer();
