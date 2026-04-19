import { createHash } from 'node:crypto'

// GitHub's per-file diff anchor is sha256(filename) hex, used as `#diff-<hex>`.
// The filename is hashed as raw UTF-8 bytes with no encoding or normalisation.
export function fileAnchor(filename: string): string {
  return 'diff-' + createHash('sha256').update(filename, 'utf8').digest('hex')
}

export function fileLink(prUrl: string, filename: string): string {
  return `${prUrl}/files#${fileAnchor(filename)}`
}
