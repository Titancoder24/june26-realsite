-- Enable realtime for worldlabs_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE worldlabs_jobs;

-- Family session invite tokens
ALTER TABLE webrtc_sessions ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;
ALTER TABLE buyer_sessions ADD COLUMN IF NOT EXISTS family_session_id UUID REFERENCES webrtc_sessions(id);

-- Campaign analytics view
CREATE OR REPLACE VIEW campaign_analytics AS
SELECT
  cl.id AS campaign_id,
  cl.utm_campaign,
  cl.utm_source,
  cl.property_id,
  COUNT(DISTINCT bs.id) AS sessions,
  COUNT(DISTINCT l.id) AS leads,
  COUNT(DISTINCT CASE WHEN l.intent_score >= 80 THEN l.id END) AS hot_leads,
  AVG(l.intent_score) AS avg_intent
FROM campaign_links cl
LEFT JOIN buyer_sessions bs ON bs.utm_campaign = cl.utm_campaign AND bs.property_id = cl.property_id
LEFT JOIN leads l ON l.campaign = cl.utm_campaign AND l.property_id = cl.property_id
GROUP BY cl.id, cl.utm_campaign, cl.utm_source, cl.property_id;

-- White-label custom domains
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS white_label_config JSONB DEFAULT '{}';
