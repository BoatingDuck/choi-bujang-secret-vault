-- 3단계: 기존 메모를 보존하면서 UUID 식별자 추가
-- 기존 BIGINT 기본키는 유지한다.

ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS note_uuid UUID;

UPDATE public.notes
SET note_uuid = gen_random_uuid()
WHERE note_uuid IS NULL;

ALTER TABLE public.notes
ALTER COLUMN note_uuid SET DEFAULT gen_random_uuid();

ALTER TABLE public.notes
ALTER COLUMN note_uuid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notes_note_uuid_idx
ON public.notes (note_uuid);

-- 서버 전용 역할에 CRUD 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.notes
TO service_role;

GRANT USAGE, SELECT
ON SEQUENCE public.notes_id_seq
TO service_role;