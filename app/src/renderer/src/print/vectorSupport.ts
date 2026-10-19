/** Raised when a resolved print primitive cannot be represented faithfully as vector output. */
export class VectorUnsupportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VectorUnsupportedError'
  }
}
