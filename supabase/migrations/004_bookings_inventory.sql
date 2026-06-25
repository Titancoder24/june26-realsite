-- V2: Site visit / video-call booking + live inventory & availability

-- ============================================================
-- Inventory: extend properties with live unit status fields
-- ============================================================
ALTER TABLE properties ADD COLUMN IF NOT EXISTS unit_number TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_current NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS held_by_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_properties_availability ON properties(availability);

-- Inventory status change audit log
CREATE TABLE IF NOT EXISTS inventory_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_changes_property ON inventory_changes(property_id);
CREATE INDEX IF NOT EXISTS idx_inventory_changes_org ON inventory_changes(organization_id);

-- ============================================================
-- Site visit / video-call booking + agent availability
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute INT NOT NULL CHECK (start_minute BETWEEN 0 AND 1440),
  end_minute INT NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
  slot_minutes INT NOT NULL DEFAULT 30,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_availability_agent ON agent_availability(agent_id);

CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  session_id UUID REFERENCES buyer_sessions(id) ON DELETE SET NULL,
  assigned_agent UUID REFERENCES profiles(id) ON DELETE SET NULL,
  webrtc_session_id UUID REFERENCES webrtc_sessions(id) ON DELETE SET NULL,
  visit_type TEXT NOT NULL DEFAULT 'in_person' CHECK (visit_type IN ('in_person', 'video_call')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  visitor_name TEXT,
  visitor_phone TEXT,
  visitor_email TEXT,
  party_size INT DEFAULT 1,
  notes TEXT,
  meeting_url TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_org ON site_visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_property ON site_visits(property_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_agent ON site_visits(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_site_visits_scheduled ON site_visits(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_status ON site_visits(status);

-- ============================================================
-- Row Level Security (org isolation, reuse auth_user_org_id())
-- ============================================================
ALTER TABLE inventory_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_inventory_changes ON inventory_changes FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_agent_availability ON agent_availability FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_site_visits ON site_visits FOR ALL USING (organization_id = auth_user_org_id());

-- ============================================================
-- Realtime: live inventory board + booking calendar
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE site_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE properties;

-- Helper view: upcoming site visits with property + agent (security_invoker respects RLS)
CREATE OR REPLACE VIEW upcoming_site_visits WITH (security_invoker = true) AS
SELECT
  sv.*,
  p.name AS property_name,
  p.unit_type AS property_unit_type,
  pr.full_name AS agent_name
FROM site_visits sv
LEFT JOIN properties p ON p.id = sv.property_id
LEFT JOIN profiles pr ON pr.id = sv.assigned_agent
WHERE sv.status IN ('requested', 'confirmed', 'rescheduled')
  AND sv.scheduled_at >= NOW() - INTERVAL '1 hour';
