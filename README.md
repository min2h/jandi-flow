# jandi-flow

매일매일 Git 잔디를 심어주는 도구

로컬에서 서버를 켜 두면, 지정한 시각 또는 하루 중 랜덤한 시각에 연결된 GitHub 레포로 commit / push 가 올라갑니다. 기존 소스와 기능은 수정하지 않습니다. 기본은 빈 커밋(`--allow-empty`)입니다.

앱 이름: **janfi-flow**  
공개 저장소: [min2h/jandi-flow](https://github.com/min2h/jandi-flow)

## 화면

다크 배경 위의 픽셀 타일 모자이크입니다. PAT로 로그인한 뒤 레포를 만들거나 HTTPS URL로 연결합니다. 로그인 없이 레이아웃만 보려면 `/?preview=1` 을 엽니다.

![로그인 화면](docs/screenshots/login.png)

![대시보드](docs/screenshots/dashboard.png)

## 바로 실행

필요: Node.js 20+, Git, GitHub PAT (`repo` 권한. public만 쓰면 `public_repo` 가능)

```bash
git clone https://github.com/min2h/jandi-flow.git
cd jandi-flow
npm install
copy .env.example .env
npm run dev
```

브라우저에서 [http://127.0.0.1:5173](http://127.0.0.1:5173) 을 엽니다. 서버 API는 `8787`입니다.

`.env`의 `JANFI_SECRET`은 비워 두면 첫 실행 때 자동 생성됩니다. **이 값과 PAT는 git에 올리지 마세요.**

Docker:

```bash
copy .env.example .env
docker compose up --build
```

이후 [http://127.0.0.1:8787](http://127.0.0.1:8787)

## 사용 순서

1. GitHub에서 PAT 발급
2. 픽셀 화면의 로그인 칸에 붙여넣기 (채팅/README에 붙이지 않기)
3. 새 레포 생성, 또는 기존 레포 `https://github.com/owner/repo` 연결
4. 스케줄(고정/랜덤), 커밋 메시지(고정/랜덤), 빈 커밋 또는 `.janfi/garden.log` 저장
5. 서버를 켜 둔 채로 두기. `지금 심기`로 바로 확인 가능

연결은 저장 전과 매일 실행 직전에 다시 검증합니다. 레포가 사라지거나 토큰/키가 바뀌면 심지 않고 상태 타일에 표시합니다.

## 옵션

| 항목 | 필수 | 설명 |
| --- | --- | --- |
| GitHub PAT | 필수 | 로컬 `data/`에만 암호화 저장 |
| 대상 레포 | 필수 | 생성 또는 HTTPS URL 연결. public/private 모두 |
| 스케줄 | 필수 | 매일 고정 시각 또는 랜덤 윈도우 (기본 Asia/Seoul) |
| 커밋 메시지 | 필수 | 고정 문장 또는 랜덤 목록 |
| 하루 커밋 수 | 선택 | 1~20, 고정/랜덤. 잔디 농도 |
| 커밋 방식 | 선택 | 빈 커밋(기본) / `.janfi/garden.log`만 추가 |
| 여러 레포 | 선택 | 연결한 모든 URL에 매일 심기 |

## 올리지 않는 것

`.gitignore`가 막습니다.

- `.env` (실제 `JANFI_SECRET`)
- `data/` (DB, 암호화된 PAT, 로컬 클론)
- `*.pem` / `*.key`
- `node_modules/`

저장소에는 `.env.example`만 있습니다.

## 주의

- 이 PC가 켜져 있고 `npm run dev` 또는 `docker compose up`이 살아 있어야 매일 심깁니다.
- 기여 그래프에  verd려면 커밋 이메일이 GitHub 계정과 맞아야 합니다. 공개 이메일이 없으면 `로그인@users.noreply.github.com`을 씁니다.
- 잔디 커밋은 앱이 연결한 **대상 레포**로만 갑니다. 이 제품 저장소(`jandi-flow`)에 더미 커밋을 섞지 않습니다.
- PAT를 이슈/README/채팅에 붙여 넣지 마세요.

## 테스트

```bash
npm test
```

로그인 성공/실패, 레포 생성, URL 연결(public/private/잘못된 URL/404/push 불가), 스케줄, 메시지, 실행 중 레포 삭제, 키 변경, 시크릿이 git에 안 들어가는 경우를 검사합니다.
