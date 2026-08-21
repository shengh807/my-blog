// 블로그 기본 설정 파일입니다. 자유롭게 수정하세요.
export default {
  // 블로그 제목 (브라우저 탭, 헤더에 표시됩니다)
  title: "제 블로그",

  // 블로그 설명 (RSS, 메타 태그에 사용됩니다)
  description: "생각과 기록을 남기는 공간입니다.",

  // 작성자 이름
  author: "Daniel",

  // 배포 후 실제 주소 (예: https://username.github.io/my-blog)
  // GitHub Pages로 배포하기 전까지는 몰라도 괜찮습니다. 나중에 채워 넣으세요.
  url: "https://shengh807.github.io/my-blog",

  // 헤더 상단 메뉴 (필요하면 추가/삭제 가능)
  nav: [
    { label: "홈", href: "/" },
    { label: "태그", href: "/tags/" },
    { label: "RSS", href: "/rss.xml" }
  ],

  // 한 페이지에 보여줄 글 개수 (그 이상은 이후 페이지로)
  postsPerPage: 10,

  // 언어 설정
  lang: "ko"
};
