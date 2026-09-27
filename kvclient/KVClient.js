const net = require("net");

class KVClient {
    /**
     * @param {Object} options
     * @param {string} options.userId
     * @param {string} [options.host = '127.0.0.1'] - Database host
     * @param {number} [options.port = 6379] - Database port
     */
    constructor(options = {}) {
        this.userId = options.userId;
        this.host = options.host || "127.0.0.1";
        this.port = options.port || 6379;
        this.client = null;
        this.dynamicBuffer = "";
        this.commandQueue = [];
        
        // handling connection promise resolution or rejection (handle server response deals with this separately)
        this._connectResolve = null;
        this._connectReject = null;
    }

    /**
     * Establishes a TCP connection to database server and completes the AUTH handshake.
     * @returns {Promise<string>} Success or Error Message from Database Server
     */
    connect() {
        if (this.client) {
            return Promise.resolve("Connection already exists for this client.");
        }

        return new Promise((resolve, reject) => {
            if (!this.userId) {
                return reject(new Error("Authentication failure: 'userId' option is required."));
            }

            this._connectResolve = resolve;
            this._connectReject = reject;

            this.client = net.createConnection({ host: this.host, port: this.port }, () => {
                this.client.write(`INIT|${this.userId}\n`);
            });

            this.client.on("data", (chunk) => {
                this.dynamicBuffer += chunk.toString("utf-8");
                let i;
                while ((i = this.dynamicBuffer.indexOf("\n")) !== -1) {
                    const resFrame = this.dynamicBuffer.substring(0, i).trim();
                    this.dynamicBuffer = this.dynamicBuffer.substring(i + 1);
                    this._handleServerResponse(resFrame);
                }
            });

            this.client.on("error", (err) => {
                if (this.commandQueue.length > 0) {
                    const nextCommand = this.commandQueue.shift();
                    nextCommand.reject(err);
                } else if (this._connectReject) {
                    this._connectReject(err);
                    this._cleanupAuthPromises();
                }
            });

            this.client.on("close", () => {
                this.disconnect();
            });
        });
    }

    _handleServerResponse(frame) {
        // handle user initialization in the tcp server
        if (frame.startsWith("SUCCESS: User initialized.") || frame.startsWith("ERR")) {
            if (frame.startsWith("ERR")) {
                if (this._connectReject) this._connectReject(new Error(frame));
                this.disconnect();
            } else {
                if (this._connectResolve) this._connectResolve("Connected & Authenticated successfully.");
            }
            this._cleanupAuthPromises(); // nulled auth promises
            return;
        }

        // Handle standard transactional commands
        if (this.commandQueue.length > 0) {
            const currentPromise = this.commandQueue.shift();
            if (frame.startsWith("ERR: ")) {
                currentPromise.reject(new Error(frame));
            } else {
                currentPromise.resolve(frame);
            }
        }
    }

    _cleanupAuthPromises() {
        this._connectResolve = null;
        this._connectReject = null;
    }

    _sendCommand(payload) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error("Database Client is not connected."));
            }
            this.commandQueue.push({ resolve, reject });
            this.client.write(`${payload}\n`);
        });
    }

    async _getSysState(){
                try {
                    const response = await this._sendCommand('SYS_STATE');
                    let sysState;
                    if(response.startsWith('SYS_STATE|')){
                        sysState = response.substring(10);
                    }
                    if(sysState){
                        return sysState;
                    }
                } catch (error) {
                    if(error.message.includes('ERR')) return null;
                    throw error;
                }
    }

    /**
     * Creates a cache (scoped context instance)
     * each cache -> have their own context (no need to share cacheIDs separately over tcp pipeline)
     * context handles the cacheID for a given user in the server
     * single KV client class -> multiple cacheInstances each with their own context and thus cacheID
     */
    async createCache() {
        const rawResponse = await this._sendCommand("CREATE");
        
        if (!rawResponse.startsWith("CACHE_ID|")) {
            throw new Error(`Failed to create a cache instance: ${rawResponse}`);
        }

        const cacheID = rawResponse.substring(9).trim();
        const self = this; 

        // return a scoped context instance for each createCache request
        return {
            cacheID: cacheID,
            async set(key, value, ttl) {
                const payload = ttl !== undefined 
                    ? `SET|${cacheID}|${key}|${value}|${ttl}` 
                    : `SET|${cacheID}|${key}|${value}`;
                return self._sendCommand(payload);
            },
            async get(key) {
                try {
                    const response = await self._sendCommand(`GET|${cacheID}|${key}`);
                    if (response.startsWith("VALUE|")) {
                        return response.substring(6);
                    }
                    return null;
                } catch (err) {
                    if (err.message.includes("ERR")) return null;
                    throw err;
                }
            },
            async del(key) {
                return self._sendCommand(`DEL|${cacheID}|${key}`);
            },
            async getStats(){
                try {
                    const response = await self._sendCommand(`STATS|${cacheID}`);
                    let stats;
                    if(response.startsWith('STATS|')){
                        stats = response.substring(6);
                    }
                    if(stats){
                        return stats;
                    }
                } catch (error) {
                    if(error.message.includes('ERR')) return null;
                    throw error;
                }
            }
        };
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            this.client.destroy(); 
            this.client = null;
        }
        this.commandQueue.forEach(cmd => cmd.reject(new Error("Client disconnected.")));
        this.commandQueue = [];
        console.log("Disconnected from the server.")
    }
}

module.exports = KVClient;
