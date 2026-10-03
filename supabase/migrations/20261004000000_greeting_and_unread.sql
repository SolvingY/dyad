-- Daily greeting from the agent and unread tracking for the Dyad thread.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS thread_seen_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_greeted_on date;
