-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a function to call the scheduled-jobs edge function
CREATE OR REPLACE FUNCTION public.invoke_scheduled_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get the Supabase URL from environment
  edge_function_url := 'https://tihsdjzeodiyblvhugbu.supabase.co/functions/v1/scheduled-jobs';
  
  -- Make HTTP request to edge function
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule the job to run every hour at minute 0
SELECT cron.schedule(
  'scheduled-jobs-hourly',
  '0 * * * *',
  $$SELECT net.http_post(
    url := 'https://tihsdjzeodiyblvhugbu.supabase.co/functions/v1/scheduled-jobs',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);