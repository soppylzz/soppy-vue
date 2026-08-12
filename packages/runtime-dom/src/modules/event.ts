import type { MaybeArray } from "@soppy-vue/shared"
import { ensureArray, hyphenate, isArray } from "@soppy-vue/shared"

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type EventValue = MaybeArray<Function>

const veiKey = Symbol("vue-event-invoker")

interface Invoker extends EventListener {
  value: EventValue
}

function createInvoker(value: EventValue) {
  const invoker: Invoker = (e: Event) => {
    const listeners = ensureArray(patchStopImmediatePropagation(e, value))
    listeners.forEach((fn) => fn(e))
  }
  invoker.value = value
  return invoker
}

/**
 * light: implement the equivalent of `stopImmediatePropagation` for single listener binding
 *
 * distinguish:
 * - stopImmediatePropagation: prevents other listeners on the same element from being invoked
 * - stopPropagation: only prevents the event from propagating to other elements
 */
function patchStopImmediatePropagation(e: Event, value: EventValue) {
  if (isArray(value)) {
    const originStop = e.stopImmediatePropagation
    e.stopImmediatePropagation = () => {
      // ensure this point at origin event
      originStop.call(e)
      ;(e as any)._stopped = true
    }
    return value.map((fn) => (e: Event) => !(e as any)._stopped && fn && fn(e))
  } else {
    return value
  }
}

function patchEvent(
  el: Element & { [veiKey]?: Record<string, Invoker | undefined> },
  name: string,
  value: EventValue
) {
  const invokers = el[veiKey] || (el[veiKey] = {})
  const prevInvoker = invokers[name]

  if (value && prevInvoker) {
    prevInvoker.value = value
  } else {
    // light: separate the content in the processing branch that does not use `parseName`
    const [event, options] = parseName(name)

    if (value) {
      const invoker = (invokers[name] = createInvoker(value))
      el.addEventListener(event, invoker, options)
    } else if (prevInvoker) {
      el.removeEventListener(event, prevInvoker, options)
      invokers[name] = undefined
    }
  }
}

/**
 * support the event name format of vue@3.4 for now
 * question: why choose ":" as separator? actually, we use @click.passive to set the options.
 */
function parseName(name: string): [string, EventListenerOptions | undefined] {
  let options: EventListenerOptions | undefined

  let matches: RegExpMatchArray | null = null
  while ((matches = name.match(/(Passive|Once|Capture)$/))) {
    if (!options) options = {}
    // cut name and fill options
    name = name.slice(0, name.length - matches[1].length)
    ;(options as any)[matches[1].toLowerCase()] = true
  }
  return [hyphenate(name.slice(2)), options]
}

export { patchEvent }
