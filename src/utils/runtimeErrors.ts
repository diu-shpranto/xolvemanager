const chunkLoadErrorPattern = /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export const isChunkLoadError = (error: Error): boolean =>
  chunkLoadErrorPattern.test(`${error.name}: ${error.message}`);
