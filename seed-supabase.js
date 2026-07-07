import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const password = args[1];

  if (!email || !password) {
    console.log("Usage: node seed-supabase.js <email> <password>");
    console.log("Example: node seed-supabase.js test@example.com password123");
    process.exit(1);
  }

  console.log(`Attempting to sign in user: ${email}...`);

  // Sign in
  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error("Authentication failed:", authError.message);
    process.exit(1);
  }

  console.log(`Signed in successfully! User ID: ${user.id}`);

  // Read demo_data.json
  const demoDataPath = path.resolve("demo_data.json");
  if (!fs.existsSync(demoDataPath)) {
    console.error(`Error: Could not find demo_data.json at ${demoDataPath}`);
    process.exit(1);
  }

  const demoData = JSON.parse(fs.readFileSync(demoDataPath, "utf8"));

  console.log("Upserting demo data to user_data table...");
  const { error: upsertError } = await supabase
    .from("user_data")
    .upsert({
      user_id: user.id,
      tasks: demoData.tasks,
      habits: demoData.habits,
      settings: demoData.settings
    }, { onConflict: "user_id" });

  if (upsertError) {
    console.error("Upsert failed:", upsertError.message);
    process.exit(1);
  }

  console.log("Successfully seeded demo data to Supabase!");
  process.exit(0);
}

main();
