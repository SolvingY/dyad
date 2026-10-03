REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

GRANT UPDATE (was_corrected) ON public.agent_events TO authenticated;
CREATE POLICY agent_events_update_own ON public.agent_events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_events.agent_id AND a.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_events.agent_id AND a.user_id = (SELECT auth.uid())));
ALTER FUNCTION public.mark_event_corrected(uuid, boolean) SECURITY INVOKER;

CREATE POLICY oura_tokens_no_client_access ON public.oura_tokens AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);