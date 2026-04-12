// Type declarations for assets imported as text via `with { type: 'text' }`.
// Bun embeds these at build time; the import resolves to a plain string at runtime.

declare module '*.md' {
  const content: string
  export default content
}

declare module '*.hbs' {
  const content: string
  export default content
}

declare module '*.css' {
  const content: string
  export default content
}

declare module '../../static/highlight.min.js' {
  const content: string
  export default content
}

declare module '../../static/mermaid.min.js' {
  const content: string
  export default content
}
