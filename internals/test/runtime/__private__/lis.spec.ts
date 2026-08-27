import type { lis as _lis } from "@soppy-vue/runtime-core/lis"

const LIS_MODULE = "@soppy-vue/runtime-core/lis"

let lis: typeof _lis

describe.runIf(__DEV__)("lis", () => {
  beforeAll(async () => {
    ;({ lis } = await import(LIS_MODULE))
  })

  it("returns `[0]` for an empty array", async () => {
    expect(lis([])).toEqual([0])
  })

  it("returns `[0]` for an all-zero array (all entries skipped as piles)", async () => {
    expect(lis([0, 0, 0])).toEqual([0])
  })

  it("returns the whole sequence for a strictly increasing input", async () => {
    expect(lis([1, 2, 3, 4])).toEqual([0, 1, 2, 3])
  })

  it("returns a single index for a strictly decreasing input", async () => {
    const res = lis([4, 3, 2, 1])
    expect(res).toHaveLength(1)
    expect([4, 3, 2, 1][res[0]]).toBe(1)
  })

  it("returns a length-4 increasing subsequence for a mixed input", async () => {
    const arr = [3, 1, 2, 8, 9, 5, 6]
    const res = lis(arr)
    expect(res).toEqual([1, 2, 5, 6])
    const vals = res.map((i) => arr[i])
    expect(vals).toEqual([1, 2, 5, 6])
  })

  it("skips zero entries as pile candidates but yields an increasing subsequence", async () => {
    const arr = [0, 1, 0, 2, 0]
    const res = lis(arr)
    // seed pileTop = [0] survives; interior/trailing zeros are never new piles
    const vals = res.map((i) => arr[i])
    for (let k = 1; k < vals.length; k++) {
      expect(vals[k]).toBeGreaterThan(vals[k - 1])
    }
    // the only zero in the result is the leading seed index
    const zeroIndices = res.filter((i) => arr[i] === 0)
    expect(zeroIndices).toEqual([0])
  })

  it("treats the LIS as strict: duplicate values collapse to length 1", async () => {
    expect(lis([1, 1, 1])).toHaveLength(1)
  })

  it("does not mutate the input array", async () => {
    const arr = [3, 1, 2, 8, 9, 5, 6]
    const snapshot = arr.slice()
    lis(arr)
    expect(arr).toEqual(snapshot)
  })

  it("for deterministic inputs, indices are increasing and values strictly increasing", async () => {
    const inputs = [
      [3, 1, 2, 8, 9, 5, 6],
      [5, 3, 4, 8, 6, 7],
      [2, 2, 2, 3, 3, 3],
      [0, 2, 0, 3, 0, 1, 0],
      [9, 8, 7, 6, 5, 4],
      [1, 3, 2, 3, 1, 2, 3],
    ]

    for (const arr of inputs) {
      const res = lis(arr)
      for (let k = 1; k < res.length; k++) {
        expect(res[k]).toBeGreaterThan(res[k - 1])
        expect(arr[res[k]]).toBeGreaterThan(arr[res[k - 1]])
      }
    }
  })
})
