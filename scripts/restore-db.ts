import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "frontdesk.db");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

// List available backups
const backups = fs.readdirSync(BACKUP_DIR)
  .filter(f => f.endsWith(".db"))
  .sort()
  .reverse();

if (backups.length === 0) {
  console.error("No backups found in", BACKUP_DIR);
  process.exit(1);
}

console.log("Available backups:");
backups.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

const latest = backups[0];
const backupPath = path.join(BACKUP_DIR, latest);

// Confirm before overwriting
process.stdout.write(`\nRestore '${latest}' to '${DB_PATH}'? This will overwrite the current database. (yes/no): `);

process.stdin.on("data", (chunk) => {
  const answer = chunk.toString().trim().toLowerCase();
  if (answer === "yes" || answer === "y") {
    fs.copyFileSync(backupPath, DB_PATH);
    console.log(`Database restored from '${latest}'.`);
    process.exit(0);
  } else {
    console.log("Restore cancelled.");
    process.exit(0);
  }
});
