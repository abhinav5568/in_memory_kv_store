let lruMap = new Map();


class Node {
    constructor (_key, _val){

        this.key = _key;
        this.val = _val;

        this.next = null;
        this.prev = null;
    }
}

class DLL {
    
    constructor (){
        this.head = null;
        this.tail = null;
    }

    isEmpty (){
        if(this.head === null){
            return true;
        }
        return false;
    }

    /*
        Adds item to the head 
        if map has the key then update the value at the given node
        otherwise add a new node to the head
    */

    updateItem (_key, _val){
        let nodeRef = lruMap.get(_key);
        nodeRef.val = _val;
    }

    addItem (_key, _val){

        if(lruMap.has(_key)){
            this.updateItem(_key, _val);
            return;
        }

        let newNode = new Node(_key, _val);

        if(this.head == null){
            this.head = newNode;
            this.tail = newNode;
            lruMap.set(_key, newNode);
            return;
        }

        newNode.prev = this.head;
        newNode.next = null;

        this.head.next = newNode;
        this.head = newNode;
        lruMap.set(_key, newNode);
    }

    /* 
        Remote item from head , tail or somewhere in center
    */

    removeFromHead(_flag){
        let temp = this.head;
        if(temp.prev != null){
            temp.prev.next = null;
            this.head = temp.prev;
            temp.prev = null;
        }
        if(_flag) lruMap.delete(temp.key);
    }

    removeFromTail(_flag){
        let temp = this.tail;
        if(temp.next != null){
            temp.next.prev = null;
            this.tail = temp.next;
            temp.next = null;
        }
        if(_flag) lruMap.delete(temp.key);
    }

    removeFromMiddle(nodeRef, _flag){
        nodeRef.next.prev = nodeRef.prev;
        nodeRef.prev.next = nodeRef.next;
        nodeRef.prev = null;
        nodeRef.next = null;
        if(_flag) lruMap.delete(nodeRef.key);
    }

    removeItem(_key, _flag){

        if(!lruMap.has(_key)){
            return;
        }

        let nodeRef = lruMap.get(_key);
            
        if(nodeRef.prev === null){
            // remove from tail
            this.removeFromTail(_flag);
        }else if(nodeRef.next === null){
            // remove from head
            this.removeFromHead(_flag);
        }else{
            // remove frmo middle
            this.removeFromMiddle(nodeRef, _flag);
        }
        return 1;
    }

    display (){
        if(this.isEmpty() == false){
            console.log("[DLL] Printing the linked list : \n")
            let cur = this.head;
            while(cur != null){
                console.log(`${cur.val} `);
                cur = cur.prev;
            }
        }
    }
}


class LRUCache {
    constructor(){
        this.item_cap = 5; // max length of dll
        this.dll = new DLL();
    }

    /*
        0 soft remove (we intend to move this item to front, ie recently accessed)
        (pop the item to head of the lru, to signify most recently used item)
        1 hard remove (remove from lruMap)
        (ie. item won't be acccesible if removeItem is called by passing 1)
    */

    insert(_key, _val){
        if(lruMap.size >= this.item_cap){
            console.log("[LRU] Warning: exhausted data store size limit!!");
            console.log("[LRU] Removing the last node !!");
            this.dll.removeFromTail(1);
            this.dll.addItem(_key, _val);
            return;
        }
        this.dll.removeItem(_key, 0);  // removes from intermediary nodes
        this.dll.addItem(_key, _val); // add to front
    }

    getVal(_key){
        if(!lruMap.has(_key)) {
            console.log("[LRU] Invalid Key");
            return;
        }
        const res = lruMap.get(_key).val;
        // update to most recent (soft dlt from ll + adding to head)
        this.dll.removeItem(_key, 0);
        this.dll.addItem(_key, res);

        return res;
    }

    remove(_key){
        return this.dll.removeItem(_key, 1);
    }
}


function testLRU(){
    let temp = new LRUCache();
    // console.log("Creating a key value pair in the cache");
    temp.insert(1, "first");
    temp.insert(2, "second");
    temp.insert(3, "third");
    temp.insert(4, "fourth");
    temp.insert(5, "fifth");
    temp.dll.display();
    temp.insert(6, "sixth");
    temp.dll.display();
}

// testLRU();

module.exports = LRUCache;