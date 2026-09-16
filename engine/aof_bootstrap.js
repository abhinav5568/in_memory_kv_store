const readline = require("readline");
const fs = require("node:fs");
const path = require("node:path");
const connections = require("./init/connections.js");

function replayCommands(userID, logline) {
  const tokens = logline.trim().split("|");
  const command = tokens[0].toUpperCase();

  if (!command) {
    return;
  }

  switch (command) {
    case "CREATE": {
      const cacheID = tokens[1];
      if (!cacheID) return;
      connections.createCache(userID, cacheID);
      break;
    }
    case "SET": {
      const cacheID = tokens[1];
      const key = tokens[2];
      const value = tokens[3];
      const ttl = tokens[4];

      if (!cacheID || !key || !value) {
        return;
      }

      const cacheInstance = connections.getCache(userID, cacheID);
      if (!cacheInstance) {
        console.error(
          `[Rehydration] : Cache instance ${cacheID} not found for user ${userID}.`,
        );
        return;
      }

      if (ttl !== undefined && ttl.trim() !== "") {
        const parsedTTL = parseInt(ttl, 10);
        if (!isNaN(parsedTTL)) {
          cacheInstance.insert(key, value, parsedTTL);
        }
      } else {
        cacheInstance.insert(key, value);
      }
      break;
    }
    case "DEL": {
      const cacheID = tokens[1];
      const key = tokens[2];
      if (!key || !cacheID) return;
      const cacheInstance = connections.getCache(userID, cacheID);
      cacheInstance.remove(key);
      break;
    }
    default: {
      console.log("command not recognised. ", logline);
      break;
    }
  }
}

async function bootstrap(params) {
  const storage_dir = "./data";

  if (!fs.existsSync(storage_dir)) {
    console.log("Storage directory empty. Fresh db instance initialized.");
    return;
  }

  const files = fs
    .readdirSync(storage_dir)
    .filter((file) => file.endsWith(".aof"));

  if (files.length == 0) {
    console.log("No .aof log detected. Fresh db instance initialized.");
    return;
  }

  console.log("Rehydrating db, files found. ", files.length);

  for (const file of files) {
    const userID = path.basename(file, ".aof");
    const filePath = path.join(storage_dir, file);

    connections.createUser(userID);
    // const userCache = connections.getCache(userID);

    try {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (line.trim()) {
          
          console.log("line , ", line);
          
          replayCommands(userID, line);
        }
      }

      console.log(`  └─ ✅ Restored User Block: [${userID}]`);
    } catch (error) {
      console.error("Crashed rehydration process. userID:", userID);
      console.error(error);
    }
  }
  console.log("System state is rehydrated.");
}

module.exports = bootstrap;
