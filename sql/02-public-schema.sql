-- 2단계 공개용 데이터베이스 구조
-- 가상 메모 본문은 공개 저장소에 포함하지 않음

CREATE TABLE IF NOT EXISTS public.notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id UUID,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.notes
ENABLE ROW LEVEL SECURITY;

-- 일반 사용자 직접 접근 권한 제거
REVOKE ALL PRIVILEGES ON TABLE public.notes
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.notes_id_seq
FROM anon, authenticated;