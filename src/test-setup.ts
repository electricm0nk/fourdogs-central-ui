import '@testing-library/jest-dom'

// jsdom does not implement scrollIntoView — provide a no-op stub globally.
Element.prototype.scrollIntoView = () => {}
