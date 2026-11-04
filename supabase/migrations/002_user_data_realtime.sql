-- ============================================================
-- 002_user_data_realtime.sql
-- Lets an open app tab hear about changes made elsewhere (ChatGPT via the
-- MCP server, another device) and reload them right away.
-- Run once in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Run
-- Row-level security still applies: each user only hears about their own row.
-- ============================================================

alter publication supabase_realtime add table public.user_data;
