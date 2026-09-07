const readline = require("readline");
const fs = require('node:fs');
const path = require('node:path');
const connections = require('./init/connections.js')

function replayCommands(cache, logline){
    const tokens = logline.trim().split('|');
    const command = tokens[0].toUpperCase();
    const key = tokens[1];
    const value = tokens[2];
    const ttl = tokens[3];

    if(!command){
        return;
    }

    switch(command){
        case 'SET': 
            if(!key || !value){
                return;
            }

            if(ttl !== undefined && ttl.trim() !== ''){
                const parsedTTL = parseInt(ttl, 10);
                if(!isNaN(parsedTTL)){
                    cache.insert(key, value, parsedTTL);
                }
            }else{
                cache.insert(key, value);
            }
            break;

        case 'DEL': 
            if(!key) return;
            cache.remove(key);
            break;

        default: 
            console.log("command not recognised. ", logline);
            break;
    }
}

async function bootstrap(params) {
    const storage_dir = './data';

    if(!fs.existsSync(storage_dir)){
        console.log("Storage directory empty. Fresh db instance initialized.")
        return;
    }

    const files = fs.readdirSync(storage_dir)
                    .filter(file => file.endsWith('.aof'));
    
    if(files.length == 0){
        console.log("No .aof log detected. Fresh db instance initialized.")
        return;
    }

    console.log("Rehydrating db, files found. ", files.length);

    for(const file of files){
        const userID = path.basename(file, '.aof');
        const filePath = path.join(storage_dir, file);

        connections.createUser(userID);
        const userCache = connections.getCache(userID);

        try {
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream, 
                crlfDelay: Infinity
            });

            for await (const line of rl){
                if(line.trim()){
                    if(userCache){console.log("line , ", line);}
                    replayCommands(userCache, line);
                }
            }

            console.log(`  └─ ✅ Restored User Block: [${userID}]`);
        } catch (error ){
            console.error("Crashed rehydration process. userID:", userID);
            console.error(error);
        }
    }
    console.log("System state is rehydrated.");
}

module.exports = bootstrap;
