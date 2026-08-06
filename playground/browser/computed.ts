import { ref, reactive, computed, effect } from "@soppy-vue/reactivity"

const app = document.getElementById("app")!

const count = ref(0)
const double = computed(() => count.value * 2)
const quadruple = computed(() => double.value * 2)

const obj = reactive({ a: 1, b: 2 })
const sum = computed(() => obj.a + obj.b)

const user = reactive({ firstName: "Soppy", lastName: "Vue" })
const fullName = computed({
  get: () => `${user.firstName} ${user.lastName}`,
  set: (val: string) => {
    const parts = val.split(" ")
    user.firstName = parts[0]
    user.lastName = parts[1] ?? ""
  },
})

effect(() => {
  app.innerHTML = `
    <h2>computed demo</h2>
    <p><strong>count:</strong> ${count.value}</p>
    <p><strong>double:</strong> ${double.value}</p>
    <p><strong>quadruple:</strong> ${quadruple.value}</p>
    <hr />
    <h3>computed from reactive</h3>
    <p><strong>obj.a + obj.b:</strong> ${sum.value}</p>
    <hr />
    <h3>writable computed</h3>
    <p><strong>fullName:</strong> ${fullName.value}</p>
    <hr />
    <p style="color: #888; font-size: 14px;">
      Open DevTools Console and try:</br>
      <code>count.value++</code></br>
      <code>obj.a = 10</code></br>
      <code>obj.b = 20</code></br>
      <code>fullName.value = "Hello World"</code>
    </p>
  `
})

effect(() => {
  console.log(
    `[computed] count=${count.value}, double=${double.value}, quadruple=${quadruple.value}`
  )
})

effect(() => {
  console.log(`[computed] sum=${sum.value}`)
})

effect(() => {
  console.log(`[computed] fullName=${fullName.value}`)
})

Object.assign(window as unknown as Record<string, unknown>, {
  count,
  double,
  quadruple,
  obj,
  user,
  fullName,
})
