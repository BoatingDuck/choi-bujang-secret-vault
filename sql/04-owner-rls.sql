-- 4단계: 메모별 소유권 보호
-- 실제 시험 계정과 메모 본문은 저장소에 포함하지 않는다.

BEGIN;

REVOKE ALL ON TABLE public.notes
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.notes TO authenticated;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_owner_select ON public.notes;
DROP POLICY IF EXISTS notes_owner_insert ON public.notes;
DROP POLICY IF EXISTS notes_owner_update ON public.notes;
DROP POLICY IF EXISTS notes_owner_delete ON public.notes;

CREATE POLICY notes_owner_select
ON public.notes FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY notes_owner_insert
ON public.notes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY notes_owner_update
ON public.notes FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY notes_owner_delete
ON public.notes FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

COMMIT;
