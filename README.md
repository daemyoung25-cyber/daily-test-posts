# daily_test 자동 게시

매일 21:00(KST)에 `posts/<오늘 날짜>/`의 그림과 글을 인스타그램·스레드에 올린다.

- `image.jpg` — 1080×1350 질문 그림
- `caption.txt` — 인스타 캡션
- `threads.json` — 스레드 본문(`main`)과 결과 답글(`replies`)
- `posted.json` — 이미 올린 게시물 기록 (중복 게시 방지)

비밀값: `IG_TOKEN`, `THREADS_TOKEN` (장기 토큰, 약 60일마다 갱신).
수동 실행: Actions › 매일 21시 심리테스트 게시 › Run workflow (기본은 연습 실행).
