const fs = require('fs');
// cross os functionality (/ in windows \ in POSIX)
const path = require('node:path');

class aofLogger {
    constructor(_storage_dir = './data'){
        this.storage_dir = _storage_dir;

        this.streams = new Map(); // map to store user specific streams

        if(!fs.existsSync(this.storage_dir)){
            fs.mkdir(this.storage_dir, {recursive : true});
        }
    }

    /*
        Appends AOF log directly to the file path specific to users
        files stored as filePath/{userID}.aof
    */

    log(_userID, _commandSTR){
        if(!_userID) return;

        // get the stream for user
        let stream = this.streams.get(_userID);

        
        // if stream not initialied then initialize one
        if(!stream){
            const filePath = path.join(this.storage_dir, `${_userID}.aof`);
            stream = fs.createWriteStream(filePath, {flags: 'a', encoding: 'utf-8'});
            this.streams.set(_userID, stream);
        }

        // write the command to the user specific file
        stream.write(`${_commandSTR.trim()}\n`);
    }
}

module.exports = aofLogger;

