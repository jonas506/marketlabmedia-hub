
-- Add social media handles to clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS youtube_channel_id text,
ADD COLUMN IF NOT EXISTS tiktok_handle text;

-- Create follower snapshots table
CREATE TABLE IF NOT EXISTS public.follower_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL, -- 'instagram', 'youtube', 'tiktok'
  follower_count integer NOT NULL,
  snapshot_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.follower_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can read/write
CREATE POLICY "Authenticated users can read follower snapshots"
  ON public.follower_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert follower snapshots"
  ON public.follower_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update follower snapshots"
  ON public.follower_snapshots FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete follower snapshots"
  ON public.follower_snapshots FOR DELETE TO authenticated USING (true);

-- Service role can also access (for edge functions)
CREATE POLICY "Service role full access follower snapshots"
  ON public.follower_snapshots FOR ALL TO service_role USING (true);
