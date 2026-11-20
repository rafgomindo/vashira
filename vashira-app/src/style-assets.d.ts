// Bundled as plain text by esbuild (--loader:.csl=text --loader:.xml=text in build:main).
declare module '*.csl' {
  const xml: string;
  export default xml;
}
declare module '*.xml' {
  const xml: string;
  export default xml;
}
