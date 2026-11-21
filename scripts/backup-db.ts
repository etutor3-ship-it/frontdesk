import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(BACKUP_DIR, `frontdesk-${timestamp}.db`);

// Copy the SQLite database file
const dbPath = path.join(process.cwd(), "data", "frontdesk.db");
fs.copyFileSync(dbPath, backupPath);

console.log(`Database backed up to: ${backupPath}`);
console.log("To restore: cp", backupPath, dbPath);
