import { render, createVNode, Transition, nextTick } from "soppy-vue"
import { ref } from "@soppy-vue/reactivity"

// ---------------------------------------------------------------------------
// The `Transition` here never animates the *initial* mount (no `appear`): both
// `beforeEnter`/`enter` early-return until `state.isMounted` is true, and that
// flag is only flipped by `onMounted` after the first render. So every enter/
// leave test below drives a child in/out of a *mounted* `<Transition>` via a
// reactive flag (an update), never the first render.
// ---------------------------------------------------------------------------

function makeToggleApp(
  duration: { enter: number; leave: number },
  extraProps: Record<string, any> = {},
  defaultVisible = true
) {
  const show = ref(defaultVisible)
  const App = {
    setup() {
      return () =>
        createVNode(
          Transition,
          { duration, ...extraProps },
          {
            default: () =>
              show.value
                ? createVNode("div", { key: 1 }, "on")
                : createVNode("p", { key: 2 }, "off"),
          }
        )
    },
  }
  return { show, App }
}

// --- deterministic fake rAF + setTimeout harness ---------------------------
let rafQueue: FrameRequestCallback[]
let timeouts: Array<{ cb: () => void; at: number }>
let now: number
let origRaf: any, origSetTimeout: any

function frame() {
  now += 16
  const cbs = rafQueue
  rafQueue = []
  cbs.forEach((cb) => cb(now))
}

function runTimers(ms: number) {
  now += ms
  const due = timeouts.filter((t) => t.at <= now)
  timeouts = timeouts.filter((t) => t.at > now)
  due.forEach((t) => t.cb())
}

beforeEach(() => {
  rafQueue = []
  timeouts = []
  now = 0
  origRaf = window.requestAnimationFrame
  origSetTimeout = globalThis.setTimeout

  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  }) as any
  ;(window as any).cancelAnimationFrame = () => {}

  globalThis.setTimeout = ((cb: () => void, delay = 0) => {
    timeouts.push({ cb, at: now + delay })
    return timeouts.length
  }) as any as typeof setTimeout
  globalThis.clearTimeout = (() => {}) as any
})

afterEach(() => {
  window.requestAnimationFrame = origRaf
  globalThis.setTimeout = origSetTimeout
})

describe("enter transition", () => {
  it("adds enter-from/enter-active, then enter-to after two frames, then finishes", async () => {
    const { show, App } = makeToggleApp({ enter: 100, leave: 100 }, {}, false)
    const c = document.createElement("div")
    render(createVNode(App), c)
    expect(c.querySelector("div")).toBeNull()

    show.value = true
    await nextTick()

    const el = c.querySelector("div")!
    // immediately (before any frame): enter-from + enter-active
    expect(el.classList.contains("v-enter-from")).toBe(true)
    expect(el.classList.contains("v-enter-active")).toBe(true)

    // after two rAF frames: enter-from removed, enter-to added
    frame()
    frame()
    expect(el.classList.contains("v-enter-from")).toBe(false)
    expect(el.classList.contains("v-enter-to")).toBe(true)
    expect(el.classList.contains("v-enter-active")).toBe(true)

    // after enterDuration: enter-to / enter-active removed
    runTimers(100)
    expect(el.classList.contains("v-enter-to")).toBe(false)
    expect(el.classList.contains("v-enter-active")).toBe(false)
  })
})

describe("leave transition", () => {
  it("adds leave-from/leave-active, then leave-to, then unmounts after leaveDuration", async () => {
    const { show, App } = makeToggleApp({ enter: 100, leave: 100 })
    const c = document.createElement("div")
    render(createVNode(App), c)
    const el = c.querySelector("div")!
    expect(el).toBeTruthy()

    show.value = false
    await nextTick()

    // the leaving div now carries leave-from + leave-active
    expect(el.classList.contains("v-leave-from")).toBe(true)
    expect(el.classList.contains("v-leave-active")).toBe(true)
    expect(c.contains(el)).toBe(true)

    // after two frames: leave-from removed, leave-to added
    frame()
    frame()
    expect(el.classList.contains("v-leave-from")).toBe(false)
    expect(el.classList.contains("v-leave-to")).toBe(true)

    // after leaveDuration: node unmounted
    runTimers(100)
    expect(c.contains(el)).toBe(false)
  })
})

describe("custom classes / name", () => {
  it("name: 'fade' prefixes the default class names", async () => {
    const { show, App } = makeToggleApp({ enter: 100, leave: 100 }, { name: "fade" }, false)
    const c = document.createElement("div")
    render(createVNode(App), c)

    show.value = true
    await nextTick()

    const el = c.querySelector("div")!
    expect(el.classList.contains("fade-enter-from")).toBe(true)
    expect(el.classList.contains("fade-enter-active")).toBe(true)
  })

  it("custom enterFromClass etc. override the defaults", async () => {
    const { show, App } = makeToggleApp(
      { enter: 100, leave: 100 },
      {
        enterFromClass: "custom-from",
        enterActiveClass: "custom-active",
        enterToClass: "custom-to",
      },
      false
    )
    const c = document.createElement("div")
    render(createVNode(App), c)

    show.value = true
    await nextTick()

    const el = c.querySelector("div")!
    expect(el.classList.contains("custom-from")).toBe(true)
    expect(el.classList.contains("custom-active")).toBe(true)
    expect(el.classList.contains("v-enter-from")).toBe(false)
  })
})

describe("duration", () => {
  it("duration { enter, leave } controls when the transition finishes", async () => {
    const { show, App } = makeToggleApp({ enter: 50, leave: 50 }, {}, false)
    const c = document.createElement("div")
    render(createVNode(App), c)

    show.value = true
    await nextTick()
    frame()
    frame()

    const el = c.querySelector("div")!
    expect(el.classList.contains("v-enter-to")).toBe(true)

    // not yet finished
    runTimers(49)
    expect(el.classList.contains("v-enter-active")).toBe(true)

    runTimers(1)
    expect(el.classList.contains("v-enter-active")).toBe(false)
  })
})

describe("done hooks", () => {
  it("a custom onEnter with a done callback suppresses the auto-timeout", async () => {
    let doneFn: (() => void) | undefined
    const { show, App } = makeToggleApp(
      { enter: 100, leave: 100 },
      {
        onEnter(_el: any, done: () => void) {
          doneFn = done
        },
      },
      false
    )
    const c = document.createElement("div")
    render(createVNode(App), c)

    show.value = true
    await nextTick()
    frame()
    frame()

    const el = c.querySelector("div")!
    expect(el.classList.contains("v-enter-to")).toBe(true)

    // auto-timeout suppressed: advancing past the duration does NOT finish
    runTimers(200)
    expect(el.classList.contains("v-enter-active")).toBe(true)

    // calling done() finishes the transition
    doneFn!()
    expect(el.classList.contains("v-enter-active")).toBe(false)
    expect(el.classList.contains("v-enter-to")).toBe(false)
  })
})
