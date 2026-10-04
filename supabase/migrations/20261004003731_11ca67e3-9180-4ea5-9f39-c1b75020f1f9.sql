ALTER TABLE public.agent_events
  ADD COLUMN IF NOT EXISTS function_name text;

ALTER TABLE public.agent_daily
  ADD COLUMN IF NOT EXISTS function_success_rate numeric,
  ADD COLUMN IF NOT EXISTS function_failure_count integer,
  ADD COLUMN IF NOT EXISTS function_latency_ms numeric;

CREATE OR REPLACE FUNCTION public.refresh_agent_daily(p_agent_id uuid, p_day date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_day_start    timestamptz := (p_day::timestamp at time zone 'utc');
  v_day_end      timestamptz := ((p_day + 1)::timestamp at time zone 'utc');
  v_calls        integer;
  v_errors       integer;
  v_retries      bigint;
  v_corrected    integer;
  v_tokens_in    bigint;
  v_tokens_out   bigint;
  v_cached       bigint;
  v_p50          numeric;
  v_p95          numeric;
  v_hours        integer;
  v_fill         numeric;
  v_last_refresh timestamptz;
  v_error_rate   numeric;
  v_retry_rate   numeric;
  v_corr_rate    numeric;
  v_prior_error  numeric;
  v_freshness    integer;
  v_readiness    integer;
  v_fn_calls     integer;
  v_fn_failures  integer;
  v_fn_success   numeric;
  v_fn_latency   numeric;
  v_fn_latency_score numeric;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE e.status = 'error'),
    coalesce(sum(e.retry_count), 0),
    count(*) FILTER (WHERE e.was_corrected),
    coalesce(sum(e.tokens_in), 0),
    coalesce(sum(e.tokens_out), 0),
    coalesce(sum(e.cached_tokens), 0),
    percentile_cont(0.5) WITHIN GROUP (ORDER BY e.latency_ms),
    percentile_cont(0.95) WITHIN GROUP (ORDER BY e.latency_ms),
    count(DISTINCT date_trunc('hour', e.created_at)),
    avg(e.context_tokens::numeric / nullif(e.context_limit, 0))
  INTO
    v_calls, v_errors, v_retries, v_corrected, v_tokens_in, v_tokens_out,
    v_cached, v_p50, v_p95, v_hours, v_fill
  FROM public.agent_events e
  WHERE e.agent_id = p_agent_id
    AND e.event_type = 'llm_call'
    AND e.created_at >= v_day_start
    AND e.created_at < v_day_end;

  SELECT
    count(*),
    count(*) FILTER (WHERE e.status = 'error'),
    avg(e.latency_ms)
  INTO v_fn_calls, v_fn_failures, v_fn_latency
  FROM public.agent_events e
  WHERE e.agent_id = p_agent_id
    AND e.event_type = 'edge_invocation'
    AND e.created_at >= v_day_start
    AND e.created_at < v_day_end;

  IF v_fn_calls > 0 THEN
    v_fn_success := (v_fn_calls - v_fn_failures)::numeric / v_fn_calls;
    v_fn_latency_score := greatest(0, 1 - least(coalesce(v_fn_latency, 0), 5000) / 5000.0);
  ELSE
    v_fn_success := null;
    v_fn_latency_score := 1;
  END IF;

  SELECT max(e.created_at)
  INTO v_last_refresh
  FROM public.agent_events e
  WHERE e.agent_id = p_agent_id
    AND e.event_type = 'context_refresh'
    AND e.created_at < v_day_end;

  IF v_calls > 0 THEN
    v_error_rate := v_errors::numeric / v_calls;
    v_retry_rate := v_retries::numeric / v_calls;
    v_corr_rate := v_corrected::numeric / v_calls;
  END IF;

  SELECT avg(d.error_rate)
  INTO v_prior_error
  FROM public.agent_daily d
  WHERE d.agent_id = p_agent_id
    AND d.day < p_day
    AND d.day >= p_day - 14;

  IF v_last_refresh IS NULL THEN
    v_freshness := 0;
  ELSE
    v_freshness := greatest(0, round(
      100 - (extract(epoch FROM (least(now(), v_day_end) - v_last_refresh)) / 3600.0) * (100.0 / 72.0)
    ))::integer;
  END IF;

  v_readiness := round(
      0.25 * v_freshness
    + 0.20 * (100 - 100 * coalesce(v_corr_rate, 0))
    + 0.15 * (100 - 100 * coalesce(v_error_rate, 0))
    + 0.10 * (100 - 100 * least(coalesce(v_fill, 0), 1))
    + 0.10 * (100 - 100 * least(coalesce(v_retry_rate, 0), 1))
    + 0.15 * (100 * coalesce(v_fn_success, 1))
    + 0.05 * (100 * v_fn_latency_score)
  )::integer;

  INSERT INTO public.agent_daily AS d (
    agent_id, day, readiness_score, error_rate_deviation, freshness_score,
    cache_hit_rate, latency_variability_ms, baseline_latency_ms, calls_per_hour,
    activity_score, call_count, output_tokens, total_tokens, error_rate,
    retry_rate, correction_rate, avg_context_fill,
    function_success_rate, function_failure_count, function_latency_ms, raw
  ) VALUES (
    p_agent_id,
    p_day,
    v_readiness,
    CASE WHEN v_error_rate IS NULL THEN null
         ELSE v_error_rate - coalesce(v_prior_error, v_error_rate) END,
    v_freshness,
    CASE WHEN v_tokens_in > 0 THEN round(100.0 * v_cached / v_tokens_in, 2) END,
    v_p95 - v_p50,
    v_p50,
    CASE WHEN v_hours > 0 THEN round(v_calls::numeric / v_hours, 2) END,
    least(100, round(100.0 * v_calls / 50))::integer,
    v_calls,
    v_tokens_out::integer,
    (v_tokens_in + v_tokens_out)::integer,
    v_error_rate,
    v_retry_rate,
    v_corr_rate,
    v_fill,
    v_fn_success,
    v_fn_failures,
    v_fn_latency,
    jsonb_build_object(
      'errors', v_errors,
      'retries', v_retries,
      'corrected', v_corrected,
      'tokens_in', v_tokens_in,
      'cached_tokens', v_cached,
      'p95_latency_ms', v_p95,
      'active_hours', v_hours,
      'last_context_refresh', v_last_refresh,
      'function_calls', v_fn_calls
    )
  )
  ON CONFLICT (agent_id, day) DO UPDATE SET
    readiness_score        = excluded.readiness_score,
    error_rate_deviation   = excluded.error_rate_deviation,
    freshness_score        = excluded.freshness_score,
    cache_hit_rate         = excluded.cache_hit_rate,
    latency_variability_ms = excluded.latency_variability_ms,
    baseline_latency_ms    = excluded.baseline_latency_ms,
    calls_per_hour         = excluded.calls_per_hour,
    activity_score         = excluded.activity_score,
    call_count             = excluded.call_count,
    output_tokens          = excluded.output_tokens,
    total_tokens           = excluded.total_tokens,
    error_rate             = excluded.error_rate,
    retry_rate             = excluded.retry_rate,
    correction_rate        = excluded.correction_rate,
    avg_context_fill       = excluded.avg_context_fill,
    function_success_rate  = excluded.function_success_rate,
    function_failure_count = excluded.function_failure_count,
    function_latency_ms    = excluded.function_latency_ms,
    raw                    = excluded.raw;
END;
$function$;