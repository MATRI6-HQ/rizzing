import '@testing-library/jest-dom'

// jsdom doesn't implement matchMedia; some libs probe it. Provide a no-op stub.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
