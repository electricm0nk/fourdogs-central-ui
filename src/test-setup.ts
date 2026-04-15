import '@testing-library/jest-dom'

// jsdom does not implement scrollIntoView or scrollTo — provide no-op stubs globally.
Element.prototype.scrollIntoView = () => {}
Element.prototype.scrollTo = () => {}
