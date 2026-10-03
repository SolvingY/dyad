CREATE TABLE public.checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'hold',
  reason text,
  message text,
  human_readiness integer,
  agent_readiness integer,
  response_energy integer,
  response_note text,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkins_select_own ON public.checkins FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE INDEX checkins_user_created_idx ON public.checkins (user_id, created_at);