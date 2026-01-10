-- Create table to store job execution logs
CREATE TABLE public.job_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_name VARCHAR NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR NOT NULL DEFAULT 'RUNNING',
    results JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view job logs
CREATE POLICY "Admin can view job_logs" 
ON public.job_logs 
FOR SELECT 
USING (has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']::VARCHAR[]));

-- System can insert job logs (via service role)
CREATE POLICY "System can insert job_logs" 
ON public.job_logs 
FOR INSERT 
WITH CHECK (true);

-- System can update job logs (via service role)
CREATE POLICY "System can update job_logs" 
ON public.job_logs 
FOR UPDATE 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_job_logs_started_at ON public.job_logs(started_at DESC);
CREATE INDEX idx_job_logs_job_name ON public.job_logs(job_name);