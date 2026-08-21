# 제 블로그

마크다운 파일을 추가하는 것만으로 글을 발행하는 정적 블로그입니다. 워드프레스처럼 관리자 화면·데이터베이스·서버가 필요 없고, `posts/` 폴더에 `.md` 파일 하나를 추가한 뒤 빌드만 하면 됩니다. 외부 패키지가 전혀 없어서 `npm install` 없이 바로 사용할 수 있습니다.

## 요구 사항

- [Node.js](https://nodejs.org) 18 버전 이상 (없다면 설치해주세요)

## 1. 새 글 쓰기

터미널에서 이 폴더로 이동한 뒤 실행하세요.

```bash
npm run new "글 제목"
```

`posts/` 폴더에 오늘 날짜로 초안 파일이 생성됩니다. 파일을 열어 내용을 작성하고, 다 쓰셨다면 맨 위 `draft: true`를 `draft: false`로 바꿔주세요. (자세한 문법은 `posts/2026-08-21-how-to-write-a-post.md` 예시 글을 참고하세요.)

## 2. 로컬에서 미리보기

```bash
npm run preview
```

`http://localhost:4000` 에서 결과를 확인할 수 있습니다. (`Ctrl+C`로 종료)

## 3. 사이트 빌드하기

```bash
npm run build
```

`docs/` 폴더에 배포 가능한 정적 HTML 파일들이 생성됩니다. 글을 새로 쓰거나 수정할 때마다 이 명령어를 다시 실행해야 결과에 반영됩니다.

## 4. 무료로 배포하기 — GitHub Pages (추천)

가장 간단하고 완전히 무료인 방법입니다. `docs/` 폴더는 **GitHub Actions가 push할 때마다 자동으로 빌드**해주므로, 직접 빌드 결과물을 올릴 필요가 없습니다. (`.github/workflows/deploy.yml`에 이미 설정되어 있습니다.)

1. [GitHub](https://github.com)에 가입하고, 새 저장소(Repository)를 만듭니다. (Public으로 설정, README 없이 빈 저장소로)
2. 이 폴더 전체(단, `docs/`는 제외 — 자동 생성되므로 올릴 필요 없음)를 그 저장소에 올립니다.
   ```bash
   git init
   git add .
   git commit -m "블로그 시작"
   git branch -M main
   git remote add origin <저장소 주소>
   git push -u origin main
   ```
3. GitHub 저장소 페이지에서 **Settings → Pages**로 이동합니다.
4. "Build and deployment" 항목에서 Source를 **GitHub Actions**로 선택합니다. (한 번만 설정하면 됩니다)
5. **Actions** 탭에서 빌드가 진행되는 것을 확인할 수 있습니다. 1~2분 뒤 `https://내아이디.github.io/저장소이름/` 주소로 블로그가 열립니다.
6. `site.config.js` 파일의 `url` 값을 실제 주소로 바꾸고 다시 push하면 RSS·사이트맵 링크도 정확해집니다.

앞으로 새 글을 쓸 때마다: 글 작성 → `git add . && git commit -m "새 글" && git push` 만 하면 됩니다. push할 때마다 GitHub Actions가 알아서 `npm run build`를 실행하고 배포까지 해줍니다. (로컬에서 `npm run build`는 미리보기용으로만 실행하면 됩니다.)

## 4-1. 다른 무료 배포 방법

- **Netlify / Vercel**: 두 서비스 모두 무료 플랜이 있고, 저장소를 연결하면 `npm run build` 결과(`docs/` 폴더)를 자동으로 배포해줍니다. 또는 `docs/` 폴더를 웹사이트에 그대로 드래그해서 올리는 방식(Netlify Drop)도 가능합니다.
- 어느 쪽이든 "빌드 결과물이 있는 폴더"로 `docs`를 지정해주면 됩니다.

## 커스터마이징

- `site.config.js`: 블로그 제목, 설명, 작성자, 상단 메뉴 등을 수정할 수 있습니다.
- `assets/style.css`: 색상, 글꼴 크기, 여백 등 디자인을 자유롭게 바꿀 수 있습니다. (라이트/다크 모드 색상은 파일 상단의 `:root` 부분에서 관리합니다.)
- `scripts/build.js`: 사이트 생성 로직 전체가 이 파일 하나에 들어있습니다. 필요하면 자유롭게 수정하세요.

## 지원하는 마크다운 문법

제목(`#`~`######`), 굵게/기울임/취소선, 인라인 코드와 코드 블록(` ``` `), 인용(`>`), 순서 있는/없는 목록, 링크, 이미지, 표, 구분선(`---`)을 지원합니다. 다만 목록의 중첩(들여쓰기로 하위 목록 만들기)은 지원하지 않아 모두 같은 단계로 표시됩니다.

더 복잡한 마크다운 기능(각주, 목차 자동 생성 등)이 필요해지면 언제든 요청해주세요.

## 폴더 구조

```
my-blog/
├── .github/workflows/
│   └── deploy.yml       # push할 때마다 자동 빌드·배포 (GitHub Actions)
├── posts/                # 글 원고 (마크다운)
├── assets/               # CSS 등 정적 파일
├── scripts/
│   ├── build.js         # 빌드 스크립트
│   ├── new-post.js      # 새 글 생성 스크립트
│   └── serve.js          # 로컬 미리보기 서버
├── site.config.js       # 블로그 설정
├── docs/                 # 빌드 결과물 (로컬 전용, git에는 올라가지 않음)
└── package.json
```
