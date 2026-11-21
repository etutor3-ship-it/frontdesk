import { createStaffUser } from "@/lib/auth";

const username = process.env.STAFF_USERNAME || "admin";
const password = process.env.STAFF_PASSWORD;

if (!password) {
  console.error("ERROR: STAFF_PASSWORD environment variable is required");
  console.error("Example: STAFF_PASSWORD='your-secure-password' npx tsx scripts/setup-staff.ts");
  process.exit(1);
}

try {
  createStaffUser(username, password);
  console.log(`Staff user '${username}' created successfully.`);
  console.log("You can now log in at http://localhost:3000/login");
} catch (err: unknown) {
  if (err instanceof Error && err.message === "Staff user already exists") {
    console.log(`Staff user '${username}' already exists.`);
  } else {
    console.error("Failed to create staff user:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
