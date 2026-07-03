/**
 * Ambient type declarations for OTW.
 * Add global interfaces and module augmentations here as needed.
 */

declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}
