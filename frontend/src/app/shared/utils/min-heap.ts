/**
 * Generic binary min-heap. Used as the priority queue inside the
 * Dijkstra route finder (`route-finder.service.ts`), pulled out so it
 * can be unit-tested in isolation and reused.
 *
 * <p>Items are ordered by the supplied {@code compareFn}: a negative
 * return places {@code a} above {@code b}. Pushing N items and popping
 * them all is O(N log N).
 */
export class MinHeap<T> {
  private heap: T[] = [];

  constructor(private readonly compareFn: (a: T, b: T) => number) {}

  get size(): number {
    return this.heap.length;
  }

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) {return undefined;}
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const current = this.heap[i];
      const parentVal = this.heap[parent];
      if (current === undefined || parentVal === undefined || this.compareFn(current, parentVal) >= 0) {break;}
      this.heap[i] = parentVal;
      this.heap[parent] = current;
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      const smallestVal = this.heap[smallest];
      const leftVal = this.heap[left];
      const rightVal = this.heap[right];
      if (smallestVal !== undefined && left < n && leftVal !== undefined && this.compareFn(leftVal, smallestVal) < 0) {smallest = left;}
      const newSmallestVal = this.heap[smallest];
      if (newSmallestVal !== undefined && right < n && rightVal !== undefined && this.compareFn(rightVal, newSmallestVal) < 0) {smallest = right;}
      if (smallest === i) {break;}
      const iVal = this.heap[i];
      const sVal = this.heap[smallest];
      if (iVal !== undefined && sVal !== undefined) {
        this.heap[i] = sVal;
        this.heap[smallest] = iVal;
      }
      i = smallest;
    }
  }
}
