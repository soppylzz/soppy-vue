/**
 * LIS: https://en.wikipedia.org/wiki/Longest_increasing_subsequence
 * @returns index array of LIS, exclude arr[i] = 0
 */
function lis(arr: number[]): number[] {
  // prev[i] = predecessor index of `i` in a LIS, later to fill
  const prev = arr.slice()

  // this is the "top card" of each pile in Patience Sorting
  const pileTop = [0]

  let curIdx, curVal, left, right

  for (curIdx = 0; curIdx < arr.length; curIdx++) {
    curVal = arr[curIdx]

    // vue-special implementation, to skip new mount vnode
    if (curVal === 0) continue

    // case 1: current value is larger than all pile tops, build new pile
    const lastPileTop = pileTop[pileTop.length - 1]
    if (arr[lastPileTop] < curVal) {
      prev[curIdx] = lastPileTop
      pileTop.push(curIdx)
      continue
    }

    // case 2: find the **leftmost** pile where top >= curVal
    left = 0
    right = pileTop.length - 1
    while (left < right) {
      const mid = (left + right) >> 1
      if (arr[pileTop[mid]] < curVal) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    if (curVal < arr[pileTop[left]]) {
      pileTop[left] = curIdx
      if (left > 0) {
        prev[curIdx] = pileTop[left - 1]
      }
    }
  }

  /**
   * backtrack to reconstruct one LIS from predecessor pointers
   * remove the useless `pileTop[i]` from subsequent updates
   */
  curIdx = pileTop.length - 1
  curVal = pileTop[curIdx]

  while (curIdx > 0) {
    pileTop[curIdx] = curVal
    curVal = prev[curVal]
    curIdx--
  }

  return pileTop
}

export { lis }
