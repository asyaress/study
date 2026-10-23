import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import mysql from "mysql2/promise";

const FORMAT_VERSION = 1;
const DEFAULT_SNAPSHOT = path.resolve(".deploy/study-db.snapshot.json");
const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_NAME"];

function usage() {
  console.error(`Usage:
  npm run db:export -- [snapshot-path]
  npm run db:import -- <snapshot-path> --confirm-replace`);
}

function loadEnvironment() {
  try {
    process.loadEnvFile(path.resolve(".env.local"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Environment belum lengkap: ${missing.join(", ")}`);
  }
}

function databaseConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: false,
  };
}

function encodeValue(value) {
  if (Buffer.isBuffer(value)) {
    return { $type: "buffer", base64: value.toString("base64") };
  }
  if (typeof value === "bigint") {
    return { $type: "bigint", value: value.toString() };
  }
  return value;
}

function decodeValue(value) {
  if (value && typeof value === "object" && value.$type === "buffer") {
    return Buffer.from(value.base64, "base64");
  }
  if (value && typeof value === "object" && value.$type === "bigint") {
    return value.value;
  }
  return value;
}

function snapshotHash(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function listTables(connection) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
    [process.env.DB_NAME],
  );
  return rows.map((row) => row.TABLE_NAME);
}

async function listColumns(connection, table) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`,
    [process.env.DB_NAME, table],
  );
  return rows.map((row) => row.COLUMN_NAME);
}

async function exportDatabase(snapshotPath) {
  const connection = await mysql.createConnection(databaseConfig());

  try {
    const tables = [];
    for (const tableName of await listTables(connection)) {
      const columns = await listColumns(connection, tableName);
      const [rows] = await connection.query(
        `SELECT * FROM ${mysql.escapeId(tableName)}`,
      );

      tables.push({
        name: tableName,
        columns,
        rows: rows.map((row) => columns.map((column) => encodeValue(row[column]))),
      });
    }

    const snapshot = {
      format: "studyspace-database-snapshot",
      formatVersion: FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      sourceDatabase: process.env.DB_NAME,
      tables,
    };

    const contents = `${JSON.stringify(snapshot, null, 2)}\n`;
    const checksum = snapshotHash(contents);
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, contents, { mode: 0o600 });
    await writeFile(
      `${snapshotPath}.sha256`,
      `${checksum}  ${path.basename(snapshotPath)}\n`,
      { mode: 0o600 },
    );

    console.log(`Snapshot: ${snapshotPath}`);
    console.log(`SHA-256: ${checksum}`);
    for (const table of tables) {
      console.log(`${table.name}: ${table.rows.length} baris`);
    }
  } finally {
    await connection.end();
  }
}

function validateSnapshot(snapshot) {
  if (
    snapshot?.format !== "studyspace-database-snapshot" ||
    snapshot?.formatVersion !== FORMAT_VERSION ||
    !Array.isArray(snapshot.tables)
  ) {
    throw new Error("Format snapshot tidak didukung.");
  }

  const tableNames = new Set();
  for (const table of snapshot.tables) {
    if (
      typeof table?.name !== "string" ||
      !Array.isArray(table.columns) ||
      !Array.isArray(table.rows) ||
      tableNames.has(table.name)
    ) {
      throw new Error("Struktur tabel di snapshot tidak valid.");
    }
    tableNames.add(table.name);

    if (table.rows.some((row) => !Array.isArray(row) || row.length !== table.columns.length)) {
      throw new Error(`Jumlah kolom tidak konsisten pada tabel ${table.name}.`);
    }
  }
}

async function verifySnapshotFile(snapshotPath, contents) {
  const checksumPath = `${snapshotPath}.sha256`;
  await access(checksumPath);
  const checksumFile = await readFile(checksumPath, "utf8");
  const expected = checksumFile.trim().split(/\s+/)[0];
  const actual = snapshotHash(contents);
  if (!expected || expected !== actual) {
    throw new Error("Checksum snapshot tidak cocok; transfer mungkin rusak.");
  }
}

async function importDatabase(snapshotPath) {
  const contents = await readFile(snapshotPath, "utf8");
  await verifySnapshotFile(snapshotPath, contents);
  const snapshot = JSON.parse(contents);
  validateSnapshot(snapshot);

  const connection = await mysql.createConnection(databaseConfig());
  let foreignKeyChecksDisabled = false;

  try {
    const targetTables = new Set(await listTables(connection));
    for (const table of snapshot.tables) {
      if (!targetTables.has(table.name)) {
        throw new Error(
          `Tabel ${table.name} belum tersedia di database target. Impor schema terlebih dahulu.`,
        );
      }

      const targetColumns = await listColumns(connection, table.name);
      if (
        targetColumns.length !== table.columns.length ||
        targetColumns.some((column, index) => column !== table.columns[index])
      ) {
        throw new Error(`Schema tabel ${table.name} berbeda dari snapshot.`);
      }
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    foreignKeyChecksDisabled = true;
    await connection.beginTransaction();

    for (const table of [...snapshot.tables].reverse()) {
      await connection.query(`DELETE FROM ${mysql.escapeId(table.name)}`);
    }

    for (const table of snapshot.tables) {
      const escapedColumns = table.columns.map((column) => mysql.escapeId(column)).join(", ");
      for (let offset = 0; offset < table.rows.length; offset += 200) {
        const values = table.rows
          .slice(offset, offset + 200)
          .map((row) => row.map(decodeValue));
        if (values.length > 0) {
          await connection.query(
            `INSERT INTO ${mysql.escapeId(table.name)} (${escapedColumns}) VALUES ?`,
            [values],
          );
        }
      }
    }

    await connection.commit();

    for (const table of snapshot.tables) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS rowCount FROM ${mysql.escapeId(table.name)}`,
      );
      const actual = Number(rows[0].rowCount);
      if (actual !== table.rows.length) {
        throw new Error(
          `Verifikasi gagal untuk ${table.name}: ${actual} != ${table.rows.length}`,
        );
      }
      console.log(`${table.name}: ${actual} baris`);
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (foreignKeyChecksDisabled) {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }
    await connection.end();
  }

  console.log("Impor database selesai dan jumlah baris terverifikasi.");
}

async function main() {
  const action = process.argv[2];
  const requestedPath = process.argv[3]?.startsWith("--") ? undefined : process.argv[3];
  const snapshotPath = path.resolve(requestedPath ?? DEFAULT_SNAPSHOT);

  if (action !== "export" && action !== "import") {
    usage();
    process.exitCode = 1;
    return;
  }

  if (action === "import" && !process.argv.includes("--confirm-replace")) {
    throw new Error(
      "Impor akan mengganti seluruh data target. Jalankan lagi dengan --confirm-replace setelah membuat backup.",
    );
  }

  loadEnvironment();
  if (action === "export") {
    await exportDatabase(snapshotPath);
  } else {
    await importDatabase(snapshotPath);
  }
}

main().catch((error) => {
  console.error(`Database transfer gagal: ${error.message}`);
  process.exitCode = 1;
});
