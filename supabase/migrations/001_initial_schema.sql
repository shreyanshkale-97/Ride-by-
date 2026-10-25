-- ============================================================
-- RideBy — Complete Database Migration (Fixed & Robust)
-- Works in any Supabase project without extension dependencies
-- ============================================================

-- Ensure pgcrypto / gen_random_uuid is ready (built into Postgres 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES TABLE (mirrors auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  avatar_url  TEXT,
  fcm_token   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create profile trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Rider'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM ('planned', 'meeting', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('leader', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('pending', 'at_meeting_point', 'riding', 'stopped', 'offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 3. RIDES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rides (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name               TEXT NOT NULL CHECK (char_length(name) <= 100),
  meeting_name       TEXT NOT NULL,
  meeting_lat        DOUBLE PRECISION NOT NULL,
  meeting_lng        DOUBLE PRECISION NOT NULL,
  destination_name   TEXT NOT NULL,
  destination_lat    DOUBLE PRECISION NOT NULL,
  destination_lng    DOUBLE PRECISION NOT NULL,
  meeting_time       TIMESTAMPTZ,
  status             ride_status DEFAULT 'planned' NOT NULL,
  join_code          VARCHAR(6) UNIQUE NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rides_join_code ON public.rides(join_code);
CREATE INDEX IF NOT EXISTS idx_rides_creator   ON public.rides(creator_id);
CREATE INDEX IF NOT EXISTS idx_rides_status    ON public.rides(status);

-- ============================================================
-- 4. RIDE MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ride_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id    UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       member_role DEFAULT 'member' NOT NULL,
  status     member_status DEFAULT 'pending' NOT NULL,
  joined_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (ride_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_members_ride ON public.ride_members(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_members_user ON public.ride_members(user_id);

-- ============================================================
-- 5. RIDE MESSAGES TABLE (Chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ride_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id    UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL CHECK (char_length(message) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ride_messages_ride ON public.ride_messages(ride_id, created_at DESC);

-- ============================================================
-- 6. EMERGENCY EVENTS TABLE (SOS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emergency_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_emergency_ride ON public.emergency_events(ride_id, created_at DESC);

-- ============================================================
-- 7. RIDE HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ride_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id        UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_distance DOUBLE PRECISION,
  duration_min   INTEGER,
  member_count   INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ride_history_user ON public.ride_history(user_id, created_at DESC);

-- ============================================================
-- 8. HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_ride_member(p_ride_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ride_members
    WHERE ride_id = p_ride_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_ride_leader(p_ride_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ride_members
    WHERE ride_id = p_ride_id AND user_id = p_user_id AND role = 'leader'
  );
$$;

-- Safe preview RPC for joining by code without private ride data exposure
CREATE OR REPLACE FUNCTION public.get_ride_by_code(p_code VARCHAR)
RETURNS TABLE (
  ride_id          UUID,
  ride_name        TEXT,
  meeting_name     TEXT,
  destination_name TEXT,
  meeting_time     TIMESTAMPTZ,
  status           ride_status,
  member_count     BIGINT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    r.id,
    r.name,
    r.meeting_name,
    r.destination_name,
    r.meeting_time,
    r.status,
    (SELECT COUNT(*) FROM public.ride_members rm WHERE rm.ride_id = r.id)
  FROM public.rides r
  WHERE r.join_code = UPPER(TRIM(p_code))
    AND r.status NOT IN ('completed', 'cancelled')
  LIMIT 1;
$$;

-- ============================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_history     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS POLICIES
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- rides
DROP POLICY IF EXISTS "rides_select_members" ON public.rides;
DROP POLICY IF EXISTS "rides_select" ON public.rides;
CREATE POLICY "rides_select" ON public.rides
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid() 
    OR public.is_ride_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "rides_insert" ON public.rides;
CREATE POLICY "rides_insert" ON public.rides
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "rides_update_creator" ON public.rides;
CREATE POLICY "rides_update_creator" ON public.rides
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- ride_members
DROP POLICY IF EXISTS "members_select" ON public.ride_members;
CREATE POLICY "members_select" ON public.ride_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ride_member(ride_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_members.ride_id AND r.creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "members_insert_self" ON public.ride_members;
CREATE POLICY "members_insert_self" ON public.ride_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "members_update" ON public.ride_members;
CREATE POLICY "members_update" ON public.ride_members
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_ride_leader(ride_id, auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_ride_leader(ride_id, auth.uid()));

-- ride_messages
DROP POLICY IF EXISTS "messages_select" ON public.ride_messages;
CREATE POLICY "messages_select" ON public.ride_messages
  FOR SELECT TO authenticated
  USING (public.is_ride_member(ride_id, auth.uid()));

DROP POLICY IF EXISTS "messages_insert" ON public.ride_messages;
CREATE POLICY "messages_insert" ON public.ride_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_ride_member(ride_id, auth.uid()));

-- emergency_events
DROP POLICY IF EXISTS "emergency_select" ON public.emergency_events;
CREATE POLICY "emergency_select" ON public.emergency_events
  FOR SELECT TO authenticated
  USING (public.is_ride_member(ride_id, auth.uid()));

DROP POLICY IF EXISTS "emergency_insert" ON public.emergency_events;
CREATE POLICY "emergency_insert" ON public.emergency_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_ride_member(ride_id, auth.uid()));

-- ride_history
DROP POLICY IF EXISTS "history_select_own" ON public.ride_history;
CREATE POLICY "history_select_own" ON public.ride_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "history_insert_own" ON public.ride_history;
CREATE POLICY "history_insert_own" ON public.ride_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 11. REALTIME BROADCAST AUTHORIZATION (Safe wrapper)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'realtime' AND table_name = 'messages'
  ) THEN
    DROP POLICY IF EXISTS "realtime_ride_receive" ON realtime.messages;
    CREATE POLICY "realtime_ride_receive" ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        realtime.messages.extension = 'broadcast'
        AND public.is_ride_member(
          (regexp_match(realtime.topic(), '^ride:(.+)$'))[1]::UUID,
          auth.uid()
        )
      );

    DROP POLICY IF EXISTS "realtime_ride_send" ON realtime.messages;
    CREATE POLICY "realtime_ride_send" ON realtime.messages
      FOR INSERT TO authenticated
      WITH CHECK (
        realtime.messages.extension = 'broadcast'
        AND public.is_ride_member(
          (regexp_match(realtime.topic(), '^ride:(.+)$'))[1]::UUID,
          auth.uid()
        )
      );
  END IF;
END $$;
