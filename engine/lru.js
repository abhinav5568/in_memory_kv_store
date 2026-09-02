class Node {
  constructor(_key, _val) {
    this.key = _key;
    this.val = _val;
    this.next = null;
    this.prev = null;
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
  addItem(_key, _val) {
    let newNode = new Node(_key, _val);
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

  insert(_key, _val) {
    this.command_count++;
    
    if (this.lruMap.has(_key)) {
      let nodeRef = this.lruMap.get(_key);
      this.dll.removeItem(nodeRef);
      let newNode = this.dll.addItem(_key, _val);
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

    
    let newNode = this.dll.addItem(_key, _val);
    this.lruMap.set(_key, newNode);
  }

  getVal(_key) {
    this.command_count++;

    if (!this.lruMap.has(_key)) {
      console.log("[LRU] Invalid Key:", _key);
      return null;
    }
    let nodeRef = this.lruMap.get(_key);
    const value = nodeRef.val;

    // Refresh item priority (Move to head)
    this.dll.removeItem(nodeRef);
    let newNode = this.dll.addItem(_key, value);
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

// Test
function testLRU() {
  let cache = new LRUCache(5);
  cache.insert(1, "first");
  cache.insert(2, "second");
  cache.insert(3, "third");
  cache.insert(4, "fourth");
  cache.insert(5, "fifth");
  
  console.log("Initial Cache Size:", cache.lruSize());
  cache.dll.display();

  console.log("\n--- Triggering Eviction ---");
  cache.insert(6, "sixth"); // Should evict key 1
  console.log("Cache Size after eviction:", cache.lruSize());
  cache.dll.display();

  console.log("\n--- Accessing Key 2 (Should move to Head) ---");
  cache.getVal(2);
  cache.dll.display();
  let metrics = cache.command_count();
  console.log("metrics count !");
}

// testLRU();
module.exports = LRUCache;
