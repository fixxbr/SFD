-- Approved recommended documents, added to every active visa template as OPTIONAL items.
-- Idempotent: an item is skipped when the template already has that document key,
-- so admin edits in Settings are never overwritten.
WITH additions (visa_type_code, category, document_key, document_name, sort_order) AS (
  VALUES
  ('O_1A', '12 Recommendation Letter Contacts', 'recommendation_letters', 'Signed expert / recommendation letters', 1101),
  ('O_1A', '13 Proposed O-1 Work', 'advisory_opinion', 'Advisory opinion / consultation letter (peer group or labor organization)', 1201),
  ('O_1A', '13 Proposed O-1 Work', 'contract', 'Contract or summary of oral agreement', 1202),
  ('O_1A', '13 Proposed O-1 Work', 'itinerary', 'Itinerary of events / engagements', 1203),
  ('O_1B', '01 Basic Documents', 'i94_history', 'I-94 travel history', 15),
  ('O_1B', '01 Basic Documents', 'link_portfolio', 'Portfolio / demo reel link', 16),
  ('O_1B', '02 Achievements', 'distinguished_org_evidence', 'Lead role for distinguished organizations / productions', 104),
  ('O_1B', '02 Achievements', 'testimonial_letters', 'Reviews and testimonial letters (organizations, critics, experts)', 105),
  ('O_1B', '02 Achievements', 'high_salary', 'High salary / remuneration evidence', 106),
  ('O_1B', '02 Achievements', 'recommendation_letters', 'Signed expert / recommendation letters', 107),
  ('O_1B', 'Petition documents', 'advisory_opinion', 'Advisory opinion / consultation letter (union or peer group)', 150),
  ('O_1B', 'Petition documents', 'contract', 'Contract / deal memo or summary of oral agreement', 151),
  ('O_1B', 'Petition documents', 'itinerary', 'Itinerary of events / engagements', 152),
  ('EB_1A', 'Basic immigration documents', 'current_visa', 'Current visa copy', 13),
  ('EB_1A', 'Basic immigration documents', 'i797', 'I-797 approval / receipt notices', 14),
  ('EB_1A', 'Scholarly authorship', 'citations', 'Citation records', 351),
  ('EB_1A', 'Artistic exhibitions', 'exhibitions', 'Artistic exhibitions / showcases (if arts)', 420),
  ('EB_1A', 'Commercial success', 'commercial_success', 'Commercial success in the performing arts (if applicable)', 430),
  ('EB_1A', 'Recommendation contacts', 'recommendation_letters', 'Signed expert / recommendation letters', 551),
  ('EB_1A', 'Continuing work in the U.S.', 'continuing_work', 'Evidence of continuing work in the field in the U.S.', 570),
  ('EB_1A', 'Civil documents', 'civil_documents', 'Birth / marriage certificates (principal and dependents)', 580),
  ('EB_2_NIW', 'Employment history', 'experience_letters', 'Employer experience verification letters', 121),
  ('EB_2_NIW', 'National importance evidence', 'funding_evidence', 'Grants, funding, and letters of interest', 321),
  ('EB_2_NIW', 'Future endeavor', 'business_plan', 'Business plan (entrepreneurs)', 361),
  ('EB_2_NIW', 'Recommendation contacts', 'recommendation_letters', 'Signed recommendation letters', 401),
  ('EB_2_NIW', 'Civil documents', 'civil_documents', 'Birth / marriage certificates (principal and dependents)', 500),
  ('H_1B', 'Education', 'professional_license', 'Professional license (if required for the job)', 83),
  ('H_1B', 'Employer documents', 'lca', 'Certified Labor Condition Application (LCA)', 261),
  ('H_1B', 'Employer documents', 'registration_notice', 'H-1B registration selection notice (cap cases)', 262),
  ('H_1B', 'Employer documents', 'end_client_letter', 'End-client letter / itinerary (third-party worksite)', 263),
  ('H_1B', 'Supporting letters', 'recommendation_letters', 'Signed expert / recommendation letters', 290),
  ('L_1A', 'Identity & status', 'i94', 'I-94', 13),
  ('L_1A', 'Identity & status', 'current_visa', 'Current visa copy', 14),
  ('L_1A', 'Identity & status', 'i797', 'I-797 notices / prior approvals', 15),
  ('L_1A', 'Corporate relationship', 'blanket_l', 'Blanket L approval (if applicable)', 83),
  ('L_1A', 'Company documentation', 'financial_statements', 'Financial statements / tax returns (both companies)', 221),
  ('L_1A', 'Company documentation', 'new_office_docs', 'New office lease and business plan (if applicable)', 222),
  ('L_1A', 'Supporting letters', 'recommendation_letters', 'Signed expert / recommendation letters', 250),
  ('L_1B', 'Identity & status', 'i94', 'I-94', 13),
  ('L_1B', 'Identity & status', 'current_visa', 'Current visa copy', 14),
  ('L_1B', 'Identity & status', 'i797', 'I-797 notices / prior approvals', 15),
  ('L_1B', 'Corporate relationship', 'blanket_l', 'Blanket L approval (if applicable)', 83),
  ('L_1B', 'Employment', 'training_records', 'Training records / certificates', 153),
  ('L_1B', 'Company documentation', 'financial_statements', 'Financial statements / tax returns (both companies)', 221),
  ('L_1B', 'Company documentation', 'new_office_docs', 'New office lease and business plan (if applicable)', 222),
  ('L_1B', 'Supporting letters', 'recommendation_letters', 'Signed expert / recommendation letters', 250),
  ('EB_5', 'Path of funds', 'capital_transfer', 'Proof of capital transfer (wire / escrow records)', 161),
  ('EB_5', 'Investment entity documents', 'subscription_agreement', 'Signed subscription agreement', 361),
  ('EB_5', 'Supporting letters', 'recommendation_letters', 'Signed expert / recommendation letters', 380),
  ('EB_5', 'Family/dependent documents', 'civil_documents', 'Birth / marriage certificates (principal and dependents)', 481),
  ('OTHER', 'Supporting letters', 'recommendation_letters', 'Signed expert / recommendation letters', 170)
)
INSERT INTO "visa_document_template_items"
  ("id", "template_id", "category", "document_key", "document_name", "default_required",
   "allows_multiple_files", "sort_order", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), t."id", a.category, a.document_key, a.document_name, false,
       true, a.sort_order, true, now(), now()
FROM additions a
JOIN "visa_document_templates" t ON t."visa_type_code" = a.visa_type_code AND t."is_active" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "visa_document_template_items" i
  WHERE i."template_id" = t."id" AND i."document_key" = a.document_key
);

-- O-1B portfolio is a link (URL), not a file: retire the old file item in active templates.
-- Files already uploaded under it stay visible under "Additional uploads".
UPDATE "visa_document_template_items" i
SET "is_active" = false, "updated_at" = now()
FROM "visa_document_templates" t
WHERE i."template_id" = t."id"
  AND t."visa_type_code" = 'O_1B'
  AND t."is_active" = true
  AND i."document_key" = 'portfolio'
  AND EXISTS (
    SELECT 1 FROM "visa_document_template_items" l
    WHERE l."template_id" = t."id" AND l."document_key" = 'link_portfolio'
  );
