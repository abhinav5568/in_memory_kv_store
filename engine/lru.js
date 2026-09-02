class Node {
  constructor(_key, _val, _ttl = Infinity) {
    this.key = _key;
    this.val = _val;
    this.next = null;
    this.prev = null;
    
    let safe_ttl = _ttl ?? Infinity;
    if(safe_ttl === Infinity){
      this.expires_at = Infinity;
    }else if(typeof safe_ttl === "number" && safe_ttl > 1000000000000){
      this.expires_at = safe_ttl;
    }
    else{
      this.expires_at = Date.now() + _ttl;
    }
  }
}

class DLL {
  constructor() {
    this.head = null; 
    this.tail = null;
  }

  isEmpty() {
    return this.head === null;
  }

 /*
  Adds items to the head
 */
  addItem(_key, _val, _ttl) {
    let newNode = new Node(_key, _val, _ttl);
    if (this.head === null) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.prev = this.head;
      this.head.next = newNode;
      this.head = newNode;
    }
    return newNode;
  }

  removeFromHead() {
    if (!this.head) return;
    let temp = this.head;
    if (temp.prev !== null) {
      this.head = temp.prev;
      this.head.next = null;
    } else {
      this.head = null;
      this.tail = null;
    }
  }

  removeFromTail() {
    if (!this.tail) return;
    let temp = this.tail;
    if (temp.next !== null) {
      this.tail = temp.next;
      this.tail.prev = null;
    } else {
      this.head = null;
      this.tail = null;
    }
  }

  removeFromMiddle(nodeRef) {
    nodeRef.next.prev = nodeRef.prev;
    nodeRef.prev.next = nodeRef.next;
  }

  removeItem(nodeRef) {
    if (!nodeRef) return;

    if (nodeRef === this.head && nodeRef === this.tail) {
      this.head = null;
      this.tail = null;
    } else if (nodeRef === this.tail) {
      this.removeFromTail();
    } else if (nodeRef === this.head) {
      this.removeFromHead();
    } else {
      this.removeFromMiddle(nodeRef);
    }
    nodeRef.prev = null;
    nodeRef.next = null;
  }

  /*
    Doesn't affect the timer. 
  */

  display() {
    if (!this.isEmpty()) {
      console.log("[DLL] Printing from MRU (Head) to LRU (Tail):");
      let cur = this.head;
      let elements = [];
      while (cur != null) {
        elements.push(`${cur.key}:${cur.val}`);
        cur = cur.prev;
      }
      console.log(elements.join(" -> "));
    }
  }
}

class LRUCache {
  constructor(capacity = 5) {
    this.item_cap = capacity;
    this.dll = new DLL();
    this.lruMap = new Map(); 
    this.evicted_count = 0;
    this.command_count = 0;
  }

  insert(_key, _val, _ttl) {
    this.command_count++;
    
    if (this.lruMap.has(_key)) {
      let nodeRef = this.lruMap.get(_key);
      let TTL;
      if(_ttl != undefined){
        TTL = _ttl;
      }else{
        TTL = nodeRef.expires_at;
      }
      this.dll.removeItem(nodeRef);
      let newNode = this.dll.addItem(_key, _val, TTL);
      this.lruMap.set(_key, newNode);
      return;
    }

    
    if (this.lruMap.size >= this.item_cap) {
      let lruKey = this.dll.tail.key;
      console.log(`[LRU] Capacity reached! Evicting LRU item: ${lruKey}`);
      this.dll.removeItem(this.dll.tail);
      this.lruMap.delete(lruKey);
      this.evicted_count++;
    }

    
    let newNode = this.dll.addItem(_key, _val, _ttl);
    this.lruMap.set(_key, newNode);
  }

  getVal(_key) {
    this.command_count++;

    if (!this.lruMap.has(_key)) {
      console.log("[LRU] Invalid Key:", _key);
      return null;
    }

    let nodeRef = this.lruMap.get(_key);

    // passive removal, early null return
    if(nodeRef.expires_at != Infinity && Date.now() > nodeRef.expires_at){
      this.dll.removeItem(nodeRef);
      this.lruMap.delete(nodeRef.key);
      return null;
    }

    // Refresh item priority (Move to head)
    const value = nodeRef.val;
    const TTL = nodeRef.expires_at; 
    this.dll.removeItem(nodeRef);
    let newNode = this.dll.addItem(_key, value, TTL);
    this.lruMap.set(_key, newNode);

    return value;
  }

  remove(_key) {
    this.command_count++;

    if (!this.lruMap.has(_key)) return false;
    let nodeRef = this.lruMap.get(_key);
    this.dll.removeItem(nodeRef);
    this.lruMap.delete(_key);
    return true;
  }

  setTTL(_key, _ttl){
    if(!this.lruMap.has(_key)){
      console.log("Key doesn't exist.");
      return null;
    }

    let nodeRef = this.lruMap.get(_key);
    let value = nodeRef.val;
    this.dll.removeItem(nodeRef);
    this.dll.addItem(_key, value, _ttl);
    return nodeRef.val;
  }

  stats(){
    this.command_count++;
    let current_status = {
        key_count : this.lruMap.size,
        evictions : this.evicted_count, 
        commands_interpreted : this.command_count
    }
    return current_status;
  }

  lruSize() {
    this.command_count++;
    return this.lruMap.size;
  }
}


module.exports = LRUCache;
