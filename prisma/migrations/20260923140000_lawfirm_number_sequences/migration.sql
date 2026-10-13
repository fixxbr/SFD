-- Application code allocates ASM-/REQ- numbers via lawfirm_* sequences.
-- Historical migrations created afterstem_* sequences. Bridge both without
-- resetting counters or dropping the legacy names.

DO $$
DECLARE
  cand_val bigint;
  req_val bigint;
BEGIN
  IF to_regclass('public.lawfirm_candidate_number_seq') IS NULL THEN
    CREATE SEQUENCE public.lawfirm_candidate_number_seq START 1031;
  END IF;

  IF to_regclass('public.afterstem_candidate_number_seq') IS NOT NULL THEN
    SELECT last_value INTO cand_val FROM public.afterstem_candidate_number_seq;
    PERFORM setval('public.lawfirm_candidate_number_seq', GREATEST(cand_val, 1030), true);
  END IF;

  IF to_regclass('public.lawfirm_document_request_seq') IS NULL THEN
    CREATE SEQUENCE public.lawfirm_document_request_seq START 2034;
  END IF;

  IF to_regclass('public.afterstem_document_request_seq') IS NOT NULL THEN
    SELECT last_value INTO req_val FROM public.afterstem_document_request_seq;
    PERFORM setval('public.lawfirm_document_request_seq', GREATEST(req_val, 2033), true);
  END IF;
END $$;
