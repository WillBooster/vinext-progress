// Declares vinext's next/* shims for type checking only. tsconfig `paths` must not map them:
// vinext turns `paths` into Vite aliases, and an aliased next/navigation is missed by the client
// dependency scan, so the first page load re-optimizes dependencies and reloads mid-hydration.
declare module 'next/form' {
  export { default } from 'vinext/shims/form';
}

declare module 'next/link' {
  export { default } from 'vinext/shims/link';
}

declare module 'next/navigation' {
  export * from 'vinext/shims/navigation';
}
