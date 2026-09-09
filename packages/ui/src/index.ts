// @orqafy/ui — the open-source (MIT) shadcn/ui + Kibo UI component layer,
// themed to the Orqafy tokens (DESIGN.md / D-23). NO AdminCN or shadcn/studio
// Pro paid components — this is a public AGPL repo, so everything here is MIT
// (standard shadcn primitives + Kibo wrappers) or our own code (D-26).

// Utilities
export { cn } from './lib/utils';

// Theme / tokens
export * from './theme';

// shadcn/ui base components
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/input';
export * from './components/ui/textarea';
export * from './components/ui/select';
export * from './components/ui/checkbox';
export * from './components/ui/label';
export * from './components/ui/dialog';
export * from './components/ui/table';
export * from './components/ui/form';

// Kibo UI wrappers (kanban / Gantt / dropzone)
export * from './components/kibo/kanban';
export * from './components/kibo/gantt';
export * from './components/kibo/dropzone';

// NOTE: MapPicker is deliberately NOT re-exported from this barrel. It eagerly
// imports leaflet (which touches `window` at module load), so a barrel re-export
// would pull leaflet into every server component importing from @orqafy/ui and
// break SSR prerender. Import it via the dedicated client-only subpath instead:
//   import('@orqafy/ui/map-picker')  (always with next/dynamic { ssr: false }).
