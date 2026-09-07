const net = require('net');

class KVClient {
    /**
     * @param {Object} options
     * @param {string} options.userId - The UUID assigned via INIT
     * @param {string} [options.host='127.0.0.1'] - Database host
     * @param {number} [options.port=6379] - Database port
     */
    constructor(options = {}) {
        this.userId = options.userId;
        this.host = options.host || '127.0.0.1';
        this.port = options.port || 6379;
        this.client = null;
        
        this.dynamicBuffer = '';
        this.commandQueue = []; // Tracks pending promises for commands
    }

    /**
     * Establishes a TCP connection and completes the AUTH handshake.
     * @returns {Promise<string>} Success message from the database
     */
    connect() {
        if(this.client){
            return Promise.resolve('Connection already exists to this userID.');
        }
        return new Promise((resolve, reject) => {
            if (!this.userId) {
                return reject(new Error("Authentication failure: 'userId' (UUID) option is required."));
            }

            this.client = net.createConnection({ host: this.host, port: this.port }, () => {
                this.client.write(`AUTH|${this.userId}\n`);
            });

            this.client.on('data', (chunk) => {
                this.dynamicBuffer += chunk.toString('utf8');
                
                let newlineIndex;
                while ((newlineIndex = this.dynamicBuffer.indexOf('\n')) !== -1) {
                    const responseFrame = this.dynamicBuffer.substring(0, newlineIndex).trim();
                    this.dynamicBuffer = this.dynamicBuffer.substring(newlineIndex + 1);

                    this._handleServerResponse(responseFrame, resolve, reject);
                }
            });

            this.client.on('error', (err) => {
                // If there's an active command waiting, reject it
                if (this.commandQueue.length > 0) {
                    const nextCommand = this.commandQueue.shift();
                    nextCommand.reject(err);
                } else {
                    reject(err);
                }
            });
        });
    }

    /**
     * Internal router that maps TCP incoming frames back to the waiting promises.
     */
    _handleServerResponse(frame, connectResolve, connectReject) {
        // Special case: Intercept the immediate response to the AUTH message sent on connect
        if (frame.startsWith('SUCCESS: Intialized a memory block') || frame.startsWith('ERR: Invalid user id')) {
            // server sends two responses for AUTH ('SUCCESS...' then 'OK'). We handle both.
            if (frame.startsWith('ERR:')) {
                connectReject(new Error(frame));
                this.disconnect();
            }else{
                connectResolve('Connected & Authenticated successfully.');
            }
            return;
        }


        // Standard command response routing
        if (this.commandQueue.length > 0) {
            const currentPromise = this.commandQueue.shift();
            
            if (frame.startsWith('ERR:')) {
                currentPromise.reject(new Error(frame));
            } else {
                currentPromise.resolve(frame);
            }
        }
    }

    /**
     * General function to send raw messages to the server queue
     */
    _sendCommand(payload) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('Database client is not connected.'));
            }
            
            this.commandQueue.push({ resolve, reject });
            this.client.write(`${payload}\n`);
        });
    }

    /**
     * Stores a key-value pair in your database cache block.
     * @param {string} key 
     * @param {any} value 
     * @param {number} [ttl] - Optional time to live in seconds
     * @returns {Promise<string>} 'OK'
     */
    async set(key, value, ttl) {
        const payload = ttl !== undefined ? `SET|${key}|${value}|${ttl}` : `SET|${key}|${value}`;
        return this._sendCommand(payload);
    }

    /**
     * Fetches a value associated with a key.
     * @param {string} key 
     * @returns {Promise<string|null>} The raw value, or null if missing.
     */
    async get(key) {
        try {
            const rawResponse = await this._sendCommand(`GET|${key}`);
            // Strips out your server format: "VALUE|your_data" -> "your_data"
            if (rawResponse.startsWith('VALUE|')) {
                return rawResponse.substring(6);
            }
            return null;
        } catch (err) {
            if (err.message.includes('ERR')) return null;
            throw err;
        }
    }

    /**
     * Removes an entry from the database cache block.
     * @param {string} key 
     * @returns {Promise<string>} 'OK'
     */
    async del(key) {
        return this._sendCommand(`DEL|${key}`);
    }

    /**
     * Retrieves runtime memory stats about your assigned user cache block.
     * @returns {Promise<Object>} Parsing out the JSON string metrics object
     */
    async stats() {
        const rawResponse = await this._sendCommand('STATS');
        // Strips out your server format: "OK|{...}" -> parse JSON
        if (rawResponse.startsWith('OK|')) {
            return JSON.parse(rawResponse.substring(3));
        }
        throw new Error(`Invalid stats frame format: ${rawResponse}`);
    }

    /**
     * Closes the underlying socket stream clean.
     */
    disconnect() {
        if (this.client) {
            this.client.end();
            this.client = null;
        }
    }
}

module.exports = KVClient;
