import { describe, it, expect } from 'vitest';
import { MinHeap } from './min-heap';

describe('MinHeap', () => {
  it('empties as a sorted sequence', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    for (const v of [5, 1, 4, 2, 3, 8, 6, 7]) {
      heap.push(v);
    }
    const out: number[] = [];
    while (heap.size > 0) {
      const v = heap.pop();
      if (v !== undefined) {
        out.push(v);
      }
    }
    expect(out).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('returns undefined on empty pop', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    expect(heap.pop()).toBeUndefined();
  });

  it('honours the custom comparator (max-heap when reversed)', () => {
    const heap = new MinHeap<number>((a, b) => b - a);
    [1, 3, 2].forEach(v => heap.push(v));
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(2);
    expect(heap.pop()).toBe(1);
  });

  it('orders structured items by a derived score', () => {
    interface Node { id: string; cost: number; }
    const heap = new MinHeap<Node>((a, b) => a.cost - b.cost);
    heap.push({ id: 'b', cost: 5 });
    heap.push({ id: 'a', cost: 2 });
    heap.push({ id: 'c', cost: 9 });
    expect(heap.pop()?.id).toBe('a');
    expect(heap.pop()?.id).toBe('b');
    expect(heap.pop()?.id).toBe('c');
  });

  it('size reflects pushes and pops', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    expect(heap.size).toBe(0);
    heap.push(42);
    expect(heap.size).toBe(1);
    heap.push(17);
    expect(heap.size).toBe(2);
    heap.pop();
    expect(heap.size).toBe(1);
  });
});
