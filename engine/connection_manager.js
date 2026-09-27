const { randomUUID } = require("node:crypto");
const LRUCache = require("./lru.js");


/*
    stores users who have active caches in the server only,
    map (userID, (map of CacheIds -> cache instance ptrs))
*/  

class ConnectionManager{

    constructor(){
        this.users = new Map();
    }


    // createUser(_userID){
    //     let userID = _userID || randomUUID();
    //     this.users.set(userID, new Map());
    //     return userID;
    // }


    initializeUser(_userID){
        // return this.users.has(_userID);
        if(!this.users.has(_userID)){
            this.users.set(_userID, new Map());
        }
        return true;
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

    getAllCacheStates(_userID){
        if(!this.users.has(_userID)) {
            return null;
        }

        const userCacheInstances = this.users.get(_userID); // userId -> map of cacheInstances

        // create a json response (cache_id -> stats) 
        let cache_stats = [];
        for(const [cacheID , cacheInstance] of userCacheInstances.entries()){
            
            let status = cacheInstance.stats();

            status.cacheID = cacheID;

            cache_stats.push(status);
        }

        return cache_stats;
    }
}


module.exports = ConnectionManager;