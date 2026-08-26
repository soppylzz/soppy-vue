import type {
  WatchTarget,
  WatchCallback,
  WatchEffect,
  WatchHandler,
  BaseWatchOptions,
} from "@soppy-vue/reactivity"
import { baseWatch } from "@soppy-vue/reactivity"
import { EMPTY_OBJ, extend } from "@soppy-vue/shared"
import type { SchedulerJob } from "./scheduler"
import { queueJob, queuePostFlushCbs } from "./scheduler"
import { currentInstance } from "./component"

export type {
  WatchHandler,
  WatchEffect,
  WatchSource,
  WatchCallback,
  OnCleanup,
} from "@soppy-vue/reactivity"

/* ==================== runtime types ==================== */
interface WatchEffectOptions {
  flush?: "pre" | "post" | "sync"
}
interface WatchOptions extends Pick<BaseWatchOptions, "deep">, WatchEffectOptions {}

export type { WatchEffectOptions, WatchOptions }

function doWatch(
  source: WatchTarget,
  cb: WatchCallback | null,
  options: WatchOptions = EMPTY_OBJ
): WatchHandler {
  const { flush = "pre" /* default */ } = options
  const baseOptions: BaseWatchOptions = extend({}, options)

  if (flush === "post") {
    baseOptions.scheduler = (job) => queuePostFlushCbs(job)
  } else if (flush === "pre") {
    baseOptions.scheduler = (job) => queueJob(job)
  }

  const instance = currentInstance
  baseOptions.augmentJob = (job: SchedulerJob) => {
    if (cb) job.allowRecurse = true
    if (flush === "pre") {
      job.pre = true
      if (instance) {
        job.id = instance.uid
        job.ownerInstance = instance
      }
    }
  }
  return baseWatch(source, cb, baseOptions)
}

/* ==================== watch api ==================== */
// note: ts annotations are not currently impled for `watch` & `watchEffect`.
function watch(source: WatchTarget, cb: WatchCallback, options?: WatchOptions): WatchHandler {
  return doWatch(source, cb, options)
}

function watchEffect(effect: WatchEffect, options?: WatchEffectOptions) {
  return doWatch(effect, null, options)
}

export { watch, watchEffect }
