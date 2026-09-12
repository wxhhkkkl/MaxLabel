/**
 * Legacy compatibility entrypoint.
 *
 * New code should import from ./domain or one of its bounded modules. This
 * re-export keeps existing LabelShop-compatible callers source-compatible
 * while the domain model is physically split by responsibility.
 */
export * from './domain'
