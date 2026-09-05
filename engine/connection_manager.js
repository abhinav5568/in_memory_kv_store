const { randomUUID } = require("node:crypto");
const LRUCache = require("./lru");

class ConnectionManager{
    constructor(){
        this.user_cache = new Map();
    }


    createUser(){
        // this.username = _username 
        this.userID = randomUUID(), 
        this.user_cache.set(this.userID,new LRUCache())
        return this.userID;
    }

    verifyUser(_userID){
        return this.user_cache.has(_userID);
    }

    deleteUser(_userID){
        if(this.user_cache.has(_userID)){
            this.user_cache.delete(_userID);
            return 1;
        }
        return 0;
    }

    getCache(_userID){
        if(this.user_cache.has(_userID)){
            return this.user_cache.get(_userID);
        }
        return null;
    }
}


module.exports = ConnectionManager;