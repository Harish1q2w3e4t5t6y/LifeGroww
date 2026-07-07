import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const email = "test_persistence2@example.com";
  const password = "password123";

  // 1. Sign up
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (authError && authError.message.includes("already registered")) {
    await supabase.auth.signInWithPassword({ email, password });
  }

  const { data: { user } } = await supabase.auth.getUser();
  console.log("User:", user.id);

  // 2. Upsert task
  const tasksCache = { professional: [{ id: "test-1", title: "Hello World" }] };
  const { error: upsertError } = await supabase
    .from("user_data")
    .upsert({ user_id: user.id, tasks: tasksCache }, { onConflict: "user_id" });
  
  if (upsertError) {
    console.error("Upsert error:", upsertError);
  } else {
    console.log("Upsert successful!");
  }

  // 3. Fetch task
  const { data: fetch, error: fetchError } = await supabase
    .from("user_data")
    .select("tasks")
    .eq("user_id", user.id)
    .maybeSingle();

  console.log("Fetched data:", fetch);
}
run();
