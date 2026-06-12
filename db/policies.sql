-- FlowState Wallet — RLS-Policies (Multi-Tenant Zugriffsschutz)
-- Voraussetzung: RLS ist auf allen Tabellen aktiviert (siehe schema.sql)
-- Gilt für den öffentlichen/anon Zugang (Dashboard-Login via Supabase Auth).
-- Der Server mit dem secret key umgeht RLS bewusst (Service-Rolle).
-- Stand: 31.05.2026

-- BUSINESSES: Betrieb sieht/bearbeitet nur seinen eigenen Eintrag
create policy "own business - select" on businesses
  for select using (owner_id = auth.uid());
create policy "own business - update" on businesses
  for update using (owner_id = auth.uid());

-- CAMPAIGNS: nur Kampagnen des eigenen Betriebs
create policy "own campaigns - all" on campaigns
  for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- PASSES: nur Pässe des eigenen Betriebs
create policy "own passes - all" on passes
  for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- REDEMPTIONS: nur Verlauf des eigenen Betriebs
create policy "own redemptions - all" on redemptions
  for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );
