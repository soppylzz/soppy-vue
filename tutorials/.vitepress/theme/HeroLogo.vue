<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue"
const svgRef = ref<SVGSVGElement>()

/*
 * One "signature" loop over the whole monogram — "vue" and "soppy" draw
 * together. Four sequential blocks:
 *
 *   draw → hold → erase → rest → (repeat)
 *
 * The reveal/conceal fades OVERLAP the drawing instead of taking their own
 * time slot: opacity ramps 0→1 during the start of `draw` (reveal), and 1→0
 * during the end of `erase` (conceal), so the mark is already hidden when
 * `rest` begins — and `stroke-linecap: round` never leaves a visible origin
 * dot during rest.
 */

const DRAW_MS = 3200 // draw — dashoffset len → 0
const HOLD_MS = 1500 // hold — fully drawn
const ERASE_MS = 2400 // erase — dashoffset 0 → len
const REST_MS = 900 // rest — hidden, no origin dot
const FADE_MS = 600 // reveal/conceal duration, overlapping draw/erase

const CYCLE_MS = DRAW_MS + HOLD_MS + ERASE_MS + REST_MS

let raf = 0
let start = 0
let paths: SVGPathElement[] = []

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function tick(now: number) {
  const t = (now - start) % CYCLE_MS

  // dash progress ∈ [0, 1]: 0 = erased, 1 = drawn
  let drawn: number
  let opacity: number

  if (t < DRAW_MS) {
    // draw — reveal (fade-in) overlaps the start of the draw
    const u = t / DRAW_MS
    drawn = easeInOutCubic(u)
    opacity = Math.min(1, t / FADE_MS)
  } else if (t < DRAW_MS + HOLD_MS) {
    // hold
    drawn = 1
    opacity = 1
  } else if (t < DRAW_MS + HOLD_MS + ERASE_MS) {
    // erase — conceal (fade-out) overlaps the end of the erase
    const local = t - DRAW_MS - HOLD_MS
    const u = local / ERASE_MS
    drawn = 1 - easeInOutCubic(u)
    opacity = Math.min(1, (ERASE_MS - local) / FADE_MS)
  } else {
    // rest — already fully hidden
    drawn = 0
    opacity = 0
  }

  for (const el of paths) {
    const len = +el.dataset.len!
    const base = +el.dataset.baseOpacity!
    el.style.strokeDashoffset = String(len * (1 - drawn))
    el.style.strokeOpacity = String(base * opacity)
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  const svg = svgRef.value
  if (!svg) return
  paths = Array.from(svg.querySelectorAll("path"))
  for (const el of paths) {
    const len = el.getTotalLength()
    el.dataset.len = String(len)
    el.dataset.baseOpacity = el.getAttribute("stroke-opacity") ?? "1"
    el.style.strokeDasharray = String(len)
    el.style.strokeDashoffset = String(len)
    el.style.strokeLinecap = "round"
  }
  start = performance.now()
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="hero-logo" aria-hidden="true">
    <div class="halo" />
    <svg
      ref="svgRef"
      class="mark"
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        data-letter="vue"
        class="mark-body"
        d="M229.247 410.365C226.923 430.444 224.811 470.475 234.949 469.968C245.086 469.461 275.921 415.226 290.071 388.172M305.911 412.901C299.153 422.624 287.41 443.21 294.506 447.775C301.602 452.341 314.781 430.233 320.483 418.608C313.514 442.491 309.712 479.606 350.262 436.996M369.27 435.728C371.804 434.46 407.546 423.484 412.354 401.488C416.789 381.198 373.552 408.463 366.102 428.119C359.132 446.507 357.865 491.526 440.865 417.34"
        stroke-width="24"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        data-letter="vue"
        class="mark-ghost"
        d="M237.857 416.392C235.534 436.471 233.422 476.503 243.56 475.995C253.697 475.488 284.532 421.254 298.682 394.2M314.521 418.929C307.763 428.651 296.021 449.237 303.117 453.803C310.213 458.368 323.392 436.26 329.094 424.635C322.124 448.519 318.323 485.633 358.873 443.023M377.88 441.755C380.415 440.487 416.156 429.512 420.964 407.515C425.399 387.225 382.163 414.49 374.712 434.147C367.743 452.535 366.476 497.554 449.476 423.367"
        stroke-width="24"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-opacity="0.5"
      />
      <path
        data-letter="vue"
        class="mark-accent"
        d="M223.219 405.199C220.896 425.278 218.784 465.309 228.922 464.802C239.059 464.294 269.894 410.06 284.044 383.006M299.883 407.735C293.125 417.457 281.383 438.044 288.479 442.609C295.575 447.174 308.754 425.066 314.456 413.441C307.487 437.325 303.685 474.439 344.235 431.83M363.242 430.561C365.777 429.293 401.518 418.318 406.326 396.321C410.761 376.031 367.525 403.296 360.074 422.953C353.105 441.341 351.838 486.36 434.838 412.173"
        stroke="currentColor"
        stroke-width="12"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        data-letter="soppy"
        class="mark-body"
        d="M275.889 253.421C276.388 247.835 276.861 242.33 277.302 237.061C277.574 233.802 277.833 230.632 278.078 227.589C278.397 223.616 278.691 219.858 278.954 216.395C255.706 249.115 246.234 240.505 244.943 235.769C243.651 231.033 246.234 221.131 250.54 217.687C254.845 214.243 258.289 215.534 260.011 219.839C261.733 224.145 262.594 244.81 244.943 248.254C230.821 251.01 236.763 227.589 241.498 215.534C154.101 223.714 58.0933 250.407 68.8565 297.335C79.6197 344.262 192.849 367.08 171.322 225.006C149.796 82.9314 319.424 24.3795 221.264 129.428C142.735 213.468 86.9387 239.07 68.8565 241.366M265.177 330.485C267.971 333.279 272.497 291.46 275.889 253.421M277.302 237.061C277.409 235.769 283.26 220.701 292.731 213.382C302.203 206.063 318.994 201.327 307.8 232.325C298.845 257.123 282.795 256.721 275.889 253.421M351.283 103.166C355.445 82.7879 367.385 41.859 381.851 41.1702C399.933 40.3091 359.033 190.133 325.882 205.632C292.731 221.131 334.062 153.538 334.923 186.689C335.612 213.209 349.848 205.775 356.88 198.743M340.52 216.395C335.067 249.546 333.373 294.579 370.226 209.507C370.944 223.427 370.313 260.051 362.046 295.182C351.714 339.096 312.966 358.039 334.923 295.182"
        stroke-width="24"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        data-letter="soppy"
        class="mark-ghost"
        d="M284.5 259.448C284.998 253.862 285.472 248.358 285.912 243.088C286.185 239.829 286.444 236.66 286.689 233.616C287.008 229.643 287.302 225.885 287.565 222.423C264.316 255.143 254.845 246.532 253.553 241.796C252.262 237.061 254.845 227.158 259.15 223.714C263.455 220.27 266.9 221.562 268.622 225.867C270.344 230.172 271.205 250.837 253.553 254.282C239.432 257.037 245.373 233.616 250.109 221.562C162.712 229.742 66.7039 256.434 77.4671 303.362C88.2303 350.29 201.459 373.107 179.933 231.033C158.406 88.9587 328.035 30.4069 229.874 135.456C151.346 219.495 95.5493 245.097 77.4671 247.393M273.788 336.513C276.582 339.306 281.107 297.487 284.5 259.448M285.912 243.088C286.02 241.796 291.87 226.728 301.342 219.409C310.814 212.09 327.604 207.354 316.41 238.352C307.455 263.151 291.406 262.749 284.5 259.448M359.894 109.194C364.056 88.8153 375.996 47.8864 390.461 47.1975C408.543 46.3365 367.643 196.16 334.493 211.659C301.342 227.158 342.673 159.565 343.534 192.716C344.223 219.237 358.459 211.803 365.491 204.771M349.131 222.423C343.677 255.573 341.984 300.606 378.837 215.534C379.555 229.454 378.923 266.078 370.657 301.209C360.324 345.123 321.577 364.066 343.534 301.209"
        stroke-width="24"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-opacity="0.5"
      />
      <path
        data-letter="soppy"
        class="mark-accent"
        d="M269.862 248.254C270.36 242.668 270.834 237.164 271.274 231.894C271.547 228.635 271.806 225.466 272.051 222.422C272.37 218.45 272.664 214.691 272.927 211.229C249.679 243.949 240.207 235.338 238.915 230.603C237.624 225.867 240.207 215.965 244.512 212.52C248.817 209.076 252.262 210.368 253.984 214.673C255.706 218.978 256.567 239.644 238.915 243.088C224.794 245.843 230.735 222.422 235.471 210.368C148.074 218.548 52.066 245.24 62.8292 292.168C73.5924 339.096 186.821 361.914 165.295 219.839C143.768 77.7649 313.397 19.213 215.236 124.262C136.708 208.301 80.9114 233.903 62.8292 236.199M259.15 325.319C261.944 328.112 266.469 286.293 269.862 248.254M271.274 231.894C271.382 230.603 277.232 215.534 286.704 208.215C296.176 200.896 312.966 196.16 301.772 227.158C292.817 251.957 276.768 251.555 269.862 248.254M345.256 97.9998C349.418 77.6214 361.358 36.6925 375.823 36.0037C393.906 35.1426 353.005 184.967 319.855 200.466C286.704 215.965 328.035 148.371 328.896 181.522C329.585 208.043 343.821 200.609 350.853 193.577M334.493 211.229C329.039 244.379 327.346 289.412 364.199 204.34C364.917 218.261 364.285 254.884 356.019 290.015C345.686 333.929 306.939 352.872 328.896 290.015"
        stroke="currentColor"
        stroke-width="12"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<style scoped>
.hero-logo {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mark {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.mark-accent {
  stroke: var(--hero-mark-accent);
}
.mark-body {
  stroke: var(--hero-mark-body);
}
.mark-ghost {
  stroke: var(--hero-mark-ghost);
}

.halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle at 50% 50%,
    var(--vp-c-brand-3) 0%,
    var(--vp-c-brand-1) 45%,
    var(--vp-c-brand-2) 100%
  );
  filter: blur(60px) saturate(1.2);
  box-shadow: 0 0 120px 30px var(--vp-c-brand-soft);
  animation: halo-breathe 5s ease-in-out infinite;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .halo {
    animation: none;
  }
}

@keyframes halo-breathe {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(0.92);
    opacity: 0.55;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.16);
    opacity: 1;
  }
}
</style>
