import { reactive, effect } from "@soppy-vue/reactivity"

const app = document.getElementById("app")!

const state = reactive({
  counter: 0,
  message: "hello",
  nested: {
    name: "soppy-vue",
  },
})

effect(() => {
  app.innerHTML = `
    <h2>reactive demo</h2>
    <p><strong>counter:</strong> ${state.counter}</p>
    <p><strong>message:</strong> ${state.message}</p>
    <p><strong>nested.name:</strong> ${state.nested.name}</p>
    <hr />
    <p style="color: #888; font-size: 14px;">
      Open DevTools Console and try:</br>
      <code>state.counter++</code></br>
      <code>state.message = "hi"</code></br>
      <code>state.nested.name = "vue"</code>
    </p>
  `
})

effect(() => {
  console.log(
    `[reactive] counter=${state.counter}, message=${state.message}, nested.name=${state.nested.name}`
  )
})

;(window as unknown as Record<string, unknown>).state = state
