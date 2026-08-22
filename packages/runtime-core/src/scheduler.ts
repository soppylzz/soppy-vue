import type { MaybeArray } from "@soppy-vue/shared"
import { ensureArray } from "@soppy-vue/shared"
import type { ComponentInternalInstance } from "./component"

interface SchedulerJob extends Function {
  // equals instance.uid
  id?: number
  /**
   * indicates whether the current job is pre-task,
   * used to distinguish between pre and update tasks
   */
  pre?: boolean
  // indicates whether job is enabled
  active?: boolean
  allowRecurse?: boolean
  ownerInstance?: ComponentInternalInstance
}

/* ==================== schedule utils ==================== */
const resolvePromise = Promise.resolve()
let currentFlushPromise: Promise<void> | null = null

let isFlushing = false
let isFlushPending = false

const getId = (job: SchedulerJob): number => (job.id == null ? Infinity : job.id)

/**
 * binary search to find the insertion idx in sorted queue
 * queue invariant: ascending by id, pre jobs before update within same id
 * return **first** idx where the job should be inserted, effectively:
 * - no existing job with same id: standard sorted insertion
 * - same id exists: insert after all pre jobs of that id
 */
function findInsertionIdx(id: number) {
  let start = flushIdx + 1
  let end = queue.length

  while (start < end) {
    const mid = (start + end) >> 1
    const midJob = queue[mid]
    const midId = getId(midJob)
    if (midId < id || (midId === id && midJob.pre)) {
      start = mid + 1
    } else {
      end = mid
    }
  }
  return start
}

function invalidateJob(job: SchedulerJob) {
  const i = queue.indexOf(job)
  // only remove the job awaiting execution
  if (i > flushIdx) {
    queue.splice(i, 1)
  }
}

/* ==================== pre&base render process ==================== */
/**
 * light: `pre` and `update` stage are strongly coupled. they must be
 * decided consecutively within same microtasks. therefore, we have
 * designed `job.pre`
 */
const queue: SchedulerJob[] = []
let flushIdx = 0

function queueJob(job: SchedulerJob) {
  /**
   * dedupe via `Array.prototype.includes(searchElement, fromIndex)`:
   * - `fromIndex` is the **inclusive** index to start searching from, elements
   *   before it are ignored; matched by reference identity (`===`), **not** `id`
   *
   * - `isFlushing` false -> `fromIndex = 0`, scan the whole queue
   * - `isFlushing` true && `allowRecurse` false -> `fromIndex = flushIdx`: the
   *   current job stays **inside** the search, so a job triggering itself is
   *   deduped -> **no infinite recursion**
   * - `isFlushing` true && `allowRecurse` true -> `fromIndex = flushIdx + 1`:
   *   the current job is **skipped**, so it may be enqueued again -> self
   *   re-trigger allowed, the user must stop the loop themselves
   *
   * @example `watch` marks its callback job `allowRecurse = true`, so a
   * callback mutating its own source re-runs until a guard stops it:
   * ```js
   * const count = ref(0)
   * let watchRuns = 0
   *
   * watch(count, () => {
   *   watchRuns++
   *   console.log('watch run', watchRuns)
   *   if (watchRuns < 3) {
   *     count.value++ // re-triggers this same watch job while flushing
   *   }
   * })
   * ```
   */
  if (!queue.includes(job, isFlushing && job.allowRecurse ? flushIdx + 1 : flushIdx)) {
    if (job.id == null) {
      queue.push(job)
    } else {
      // array.splice(start, deleteCount?, ...itemsToAdd?), actual insert here
      queue.splice(findInsertionIdx(job.id), 0, job)
    }

    // finally flush
    flushQueue()
  }
}

function flushQueue() {
  if (!isFlushing && isFlushPending) {
    isFlushPending = true
    currentFlushPromise = resolvePromise.then(flushJobs)
  }
}

function flushJobs() {
  isFlushPending = false
  isFlushing = true

  queue.sort((a, b) => {
    const diff = getId(a) - getId(b)
    if (diff === 0) {
      // origin: a - b
      if (a.pre && !b.pre) return -1 // a->b
      if (b.pre && !a.pre) return 1 // b->a
    }
    return diff
  })

  try {
    for (flushIdx = 0; flushIdx < queue.length; flushIdx++) {
      const job = queue[flushIdx]
      if (job && job.active !== false) {
        job()
      }
    }
  } finally {
    flushIdx = 0
    queue.length = 0

    flushPostFlushCbs()

    isFlushing = false
    currentFlushPromise = null
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs()
    }
  }
}

function flushPreFlushCbs(instance?: ComponentInternalInstance) {
  for (let i = isFlushing ? flushIdx + 1 : 0; i < queue.length; i++) {
    const cb = queue[i]
    if (cb && cb.pre) {
      if (instance && cb.id !== instance.uid) continue
      // ensure pointer-i doesn't skip to next job, as `i++` is always executed
      queue.splice(i--, 1)
      cb()
    }
  }
}

/* ==================== post render process ==================== */
const pendingPostFlushCbs: SchedulerJob[] = []
let postFlushIdx = 0
let activePostFlushCbs: SchedulerJob[] | null = null

function queuePostFlushCbs(cbs: MaybeArray<SchedulerJob>, deduped: boolean = false) {
  cbs = ensureArray(cbs)
  if (!deduped) {
    for (const cb of cbs) {
      if (
        !activePostFlushCbs ||
        !activePostFlushCbs.includes(cb, cb.allowRecurse ? postFlushIdx + 1 : postFlushIdx)
      ) {
        pendingPostFlushCbs.push(cb)
      }
    }
  } else {
    /**
     * lifecycle hooks from a component update job are already deduplicated
     * at the component level, so we can safely push them all without per-item
     * duplicate checks for better performance.
     */
    pendingPostFlushCbs.push(...cbs)
  }
  flushQueue()
}

function flushPostFlushCbs() {
  if (pendingPostFlushCbs.length) {
    // use deduped copyed for post flushing, save to activePostFlushCbs
    const deduped = [...new Set(pendingPostFlushCbs)]
    pendingPostFlushCbs.length = 0

    if (activePostFlushCbs) {
      /**
       * already have task before, update cache dynamically without any execution
       * light: to achieve this, cache is only present whilst cache is being processing
       */
      activePostFlushCbs.push(...deduped)
      return
    }

    activePostFlushCbs = deduped
    activePostFlushCbs.sort((a, b) => getId(a) - getId(b))

    for (postFlushIdx = 0; postFlushIdx < activePostFlushCbs.length; postFlushIdx++) {
      activePostFlushCbs[postFlushIdx]()
    }

    // light: must clear cache when finished
    activePostFlushCbs = null
    postFlushIdx = 0
  }
}

/* ==================== next-tick ==================== */
function nextTick<T = void, R = void>(this: T, fn?: (this: T) => R) {
  const p = currentFlushPromise || resolvePromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}

export type { SchedulerJob }
export {
  queueJob,
  flushQueue,
  flushPreFlushCbs,
  queuePostFlushCbs,
  flushPostFlushCbs,
  nextTick,
  invalidateJob,
}
