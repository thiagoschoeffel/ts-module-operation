export function navigate(to: string, replace = false) {
  const handled = window.dispatchEvent(new CustomEvent('ts:navigate', {
    detail: { to, replace },
    cancelable: true
  }))
  if (handled) window.location.assign(to)
}
