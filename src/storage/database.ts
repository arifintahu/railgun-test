import LevelDownDB from "leveldown";

/**
 * Creates a LevelDown database instance at the specified path (Node.js).
 * Mirrors the docs Step 3 implementation.
 */
export const createNodeDatabase = (dbLocationPath: string = "./engine.db") => {
  console.log("Creating local database at path:", dbLocationPath);
  const db = LevelDownDB(dbLocationPath);
  return db;
};