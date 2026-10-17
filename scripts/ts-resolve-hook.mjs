// Lets `node --test` import the app's extensionless TypeScript modules
// (lib/*.ts) directly using Node's built-in type stripping (Node >= 22.18).
// Test-only: the app itself is built by Next.js, not by this hook.
import { register } from 'node:module'

export function registerTsResolver() {
  register(new URL('./ts-resolve-hook-impl.mjs', import.meta.url))
}
