import { ref, reactive, toRef, proxyRefs, effect } from "@soppy-vue/reactivity"

const app = document.getElementById("app")!

const counter = ref(0)
const message = ref("hello")
const nested = ref({
  name: "soppy-vue",
})

// --- toRef demo ---
const state = reactive({
  title: "toRef demo",
  version: 1,
})
const titleRef = toRef(state, "title")
const versionRef = toRef(state, "version")

// --- proxyRefs demo ---
const proxyObj = proxyRefs({
  counter,
  message,
})

effect(() => {
  app.innerHTML = `
    <h2>ref demo</h2>
    <p><strong>counter:</strong> ${counter.value}</p>
    <p><strong>message:</strong> ${message.value}</p>
    <p><strong>nested.name:</strong> ${nested.value.name}</p>
    <hr />
    <h2>toRef demo</h2>
    <p><strong>title:</strong> ${titleRef.value}</p>
    <p><strong>version:</strong> ${versionRef.value}</p>
    <hr />
    <h2>proxyRefs demo</h2>
    <p><strong>proxyObj.counter:</strong> ${proxyObj.counter}</p>
    <p><strong>proxyObj.message:</strong> ${proxyObj.message}</p>
    <hr />
    <p style="color: #888; font-size: 14px;">
      Open DevTools Console and try:</br>
      <code>counter.value++</code></br>
      <code>titleRef.value = "new title"</code></br>
      <code>state.version++</code></br>
      <code>proxyObj.message = "via proxy"</code></br>
      <code>proxyObj.count = 99</code>
    </p>
  `
})

effect(() => {
  console.log(
    `[ref] counter=${counter.value}, message=${message.value}, nested.name=${nested.value.name}`
  )
})

effect(() => {
  console.log(`[toRef] title=${titleRef.value}, version=${versionRef.value}`)
})

effect(() => {
  console.log(`[proxyRefs] counter=${proxyObj.counter}, message=${proxyObj.message}`)
})

;(window as unknown as Record<string, unknown>).counter = counter
;(window as unknown as Record<string, unknown>).message = message
;(window as unknown as Record<string, unknown>).nested = nested
;(window as unknown as Record<string, unknown>).state = state
;(window as unknown as Record<string, unknown>).titleRef = titleRef
;(window as unknown as Record<string, unknown>).versionRef = versionRef
;(window as unknown as Record<string, unknown>).proxyObj = proxyObj
