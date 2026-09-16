const { randomUUID } = require("node:crypto");
const LRUCache = require("./lru.js");


/*
    stores users who have active caches in the server only,
    map (userID, map(userID, ptr to cache instance))
*/  

class ConnectionManager{

    constructor(){
        this.users = new Map();
    }


    createUser(_userID){
        let userID = _userID || randomUUID();
        this.users.set(userID, new Map());
        return userID;
    }


    verifyUser(_userID){
        return this.users.has(_userID);
    }

    deleteUser(_userID){
        if(this.users.has(_userID)){
            this.users.delete(_userID);
            return 1;
        }
        return 0;
    }

    createCache(_userID, _cacheID) {
        if(!this.users.has(_userID)) return null;

        const userCacheInstances = this.users.get(_userID);

        // cache rehydration (predefined _cacheID)
        if(_cacheID !== undefined ){
            if(!userCacheInstances.has(_cacheID)){
                userCacheInstances.set(_cacheID, new LRUCache());
            }
            return _cacheID;
        }

        // fresh cache instance for _userID (newly defined _cacheID)
        const cacheID = randomUUID();
        userCacheInstances.set(cacheID, new LRUCache());
        return cacheID; 
    }

    getCache(_userID, _cacheID){
        if(!this.users.has(_userID)){
            return null;
        }
        const userCacheInstances = this.users.get(_userID);
        if(userCacheInstances.has(_cacheID)){
            return userCacheInstances.get(_cacheID);
        }
        return null;
    }
}


module.exports = ConnectionManager;