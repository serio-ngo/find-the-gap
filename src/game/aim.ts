export const aimTracker = () => {
  let dwell: number[] = []
  let aimed = -1
  let last = -1
  let since = 0
  let switches = 0
  return {
    lock(i: number, now: number, playing: boolean) {
      if (aimed >= 0) dwell[aimed] = (dwell[aimed] ?? 0) + now - since
      aimed = i
      since = now
      if (i < 0 || !playing) return
      if (last >= 0 && i !== last) switches++
      last = i
    },
    resume(paused: number) {
      since += paused
    },
    reset(now: number) {
      dwell = []
      aimed = -1
      last = -1
      switches = 0
      since = now
    },
    read: (order: number[]) => ({ dwell: order.map((_, s) => dwell[order.indexOf(s)] ?? 0), switches }),
  }
}
