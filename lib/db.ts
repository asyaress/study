import "server-only";

import mysql, { type Pool } from "mysql2/promise";

const globalForDatabase = globalThis as unknown as { studyPool?: Pool };

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "study",
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60_000,
    charset: "utf8mb4",
    timezone: "+08:00",
    dateStrings: true,
    multipleStatements: false,
  });
}

export const db = globalForDatabase.studyPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.studyPool = db;
}
