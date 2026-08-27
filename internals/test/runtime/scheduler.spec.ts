import { nextTick, queuePostFlushCbs } from "@soppy-vue/runtime-core"
import { queueJob, flushPreFlushCbs, invalidateJob } from "@soppy-vue/runtime-core/scheduler"
import type { SchedulerJob } from "@soppy-vue/runtime-core/scheduler"

describe("queueJob", () => {
  it("jobs with ids are inserted in ascending id order", async () => {
    const order: number[] = []
    queueJob(makeJob(2, () => order.push(2)))
    queueJob(makeJob(1, () => order.push(1)))
    queueJob(makeJob(3, () => order.push(3)))
    await nextTick()
    expect(order).toEqual([1, 2, 3])
  })

  it("jobs without an id go to the end (treated as Infinity)", async () => {
    const order: (number | string)[] = []
    queueJob(makeJob(2, () => order.push(2)))
    queueJob(makeJob(undefined, () => order.push("none")))
    queueJob(makeJob(1, () => order.push(1)))
    await nextTick()
    expect(order).toEqual([1, 2, "none"])
  })

  it("pre: true jobs sort before non-pre jobs at the same id", async () => {
    const order: (number | string)[] = []
    const pre = makeJob(1, () => order.push("pre"))
    pre.pre = true
    queueJob(makeJob(1, () => order.push("update")))
    queueJob(pre)
    await nextTick()
    expect(order).toEqual(["pre", "update"])
  })

  it("duplicate jobs are deduped by reference (queued twice runs once)", async () => {
    let calls = 0
    const job = makeJob(1, () => calls++)
    queueJob(job)
    queueJob(job)
    await nextTick()
    expect(calls).toBe(1)
  })
})

describe("flush timing", () => {
  it("jobs flush in a microtask, not synchronously", async () => {
    let calls = 0
    queueJob(makeJob(1, () => calls++))
    expect(calls).toBe(0)
    await nextTick()
    expect(calls).toBe(1)
  })

  it("flushPreFlushCbs runs pre jobs in order", async () => {
    const order: number[] = []
    const a = makeJob(1, () => order.push(1))
    a.pre = true
    const b = makeJob(1, () => order.push(2))
    b.pre = true
    // enqueue pre jobs into the queue, then flush them directly (before the
    // scheduled microtask runs)
    queueJob(a)
    queueJob(b)
    flushPreFlushCbs()
    expect(order).toEqual([1, 2])
    // drain the still-scheduled (now empty) microtask flush
    await nextTick()
  })
})

describe("nextTick", () => {
  it("await nextTick() resolves after pending jobs flush", async () => {
    let calls = 0
    queueJob(makeJob(1, () => calls++))
    await nextTick()
    expect(calls).toBe(1)
  })

  it("nextTick(fn) runs fn after the flush", async () => {
    const order: string[] = []
    queueJob(makeJob(1, () => order.push("job")))
    await nextTick(() => order.push("fn"))
    expect(order).toEqual(["job", "fn"])
  })
})

describe("post flush cbs", () => {
  it("collects and flushes in order after the main queue", async () => {
    const order: string[] = []
    queueJob(makeJob(1, () => order.push("job")))
    queuePostFlushCbs(() => order.push("post1"))
    queuePostFlushCbs(() => order.push("post2"))
    await nextTick()
    expect(order).toEqual(["job", "post1", "post2"])
  })

  it("dedupes: same post cb queued twice runs once", async () => {
    let calls = 0
    const cb = () => calls++
    queuePostFlushCbs(cb)
    queuePostFlushCbs(cb)
    await nextTick()
    expect(calls).toBe(1)
  })

  it("post cbs re-queued during post flush are handled without recursion", async () => {
    const order: string[] = []
    queuePostFlushCbs(() => {
      order.push("first")
      queuePostFlushCbs(() => order.push("second"))
    })
    await nextTick()
    expect(order).toEqual(["first", "second"])
  })
})

describe("invalidateJob", () => {
  it("removes a non-flushed job (index after the flush cursor)", async () => {
    const calls: number[] = []
    const a = makeJob(1, () => calls.push(1))
    const b = makeJob(2, () => calls.push(2))
    queueJob(a)
    queueJob(b)
    invalidateJob(b)
    await nextTick()
    expect(calls).toEqual([1])
  })

  it("does NOT remove an already-flushed job (index at the flush cursor)", async () => {
    let calls = 0
    const first = makeJob(1, () => {
      // when `first` runs, flushIdx already points past it; invalidating it
      // is a no-op because `flushIdx` has moved on
      invalidateJob(first)
    })
    const second = makeJob(1, () => calls++)
    queueJob(first)
    queueJob(second)
    await nextTick()
    expect(calls).toBe(1)
  })
})

describe("allowRecurse", () => {
  it("a job re-queuing itself while flushing is deduped when allowRecurse is false", async () => {
    let runs = 0
    const job = makeJob(1, () => {
      runs++
      // self re-queue is a no-op without allowRecurse
      queueJob(job)
    })
    queueJob(job)
    await nextTick()
    expect(runs).toBe(1)
  })

  it("with allowRecurse: true, self re-queue is allowed until a guard stops it", async () => {
    let runs = 0
    const job = makeJob(1, () => {
      runs++
      if (runs < 3) queueJob(job)
    })
    job.allowRecurse = true
    queueJob(job)
    await nextTick()
    expect(runs).toBe(3)
  })
})

function makeJob(id: number | undefined, fn: () => void): SchedulerJob {
  const job = fn as SchedulerJob
  job.id = id
  return job
}
