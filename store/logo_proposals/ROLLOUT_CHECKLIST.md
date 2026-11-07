# 로고 변경 시 수정 대상 점검표 (2026-11-07, 조사만 — 코드·운영 자산은 안 건드림)

새 로고(E9 형태 + 최종 후보 P1·P12·P14 중 하나)로 바꿀 때 **어디를 고쳐야 하는지** 저장소 전체를 직접 다시 훑어 만든 목록이다. 앞서 만든 `README.md` 6장·`e9_final/README.md` 의 「바꿀 곳」은 grep 위주라 아래 내용으로 대체한다(틀린 부분은 부록 B 에 모았다).
조사 방법: 파일을 열어 본 것(iOS·Android 프로젝트, 웹, 백엔드, 스토어 문서·스크립트, my-video)과 이미지는 실제로 픽셀/모양을 확인했다. **확인 못 한 것**(콘솔·실기기·상표 검색)은 부록 C 에 따로 적었다.

> **2026-11-07 갱신(영역 C — 스토어 스크린샷·문서·릴스 엔딩·이메일)**: 로고는 **P1 확정(앰버 띠 제외)** 이고 새 로고는 **iOS 1.0.11/18·Android 1.0.14/15 에 바로 넣기로 했다**(아래 4장의 「다음 빌드로 미룬다」 판단은 사용자가 뒤집었다). 이 파일 맨 뒤 「6. 진행 상태」에 완료/미완료와 **사용자가 저장소 밖에서 할 일(드래그할 파일 경로 포함)** 을 정리했다.

> **2026-11-08 결정 — 메인 앱 아이콘 = 옅은(흰 배경) 판**(사용자: 「아이콘도 바꿔 줘야지」「흰 배경으로」). 아래 3장 표의 「P1 노랑 바탕」(기본)이 아니라 **옅은 판(흰 바탕 #FFFFFF + 노랑 재료 #FFD600 + 검정 받침 + 진초록 잎)** 이 `frontend/assets/icon.png` 마스터다. 옛 기본(노랑 바탕판)은 `frontend/assets/brand/icon_yellow_1024.png` 로 남겨 **스플래시·OG·노랑 화면 위 마크**의 바탕으로만 쓴다(스플래시는 노랑 화면 + 흰 재료 마크 그대로). iOS 다크 = 검정 바탕판, 틴트 = 검정 판 회색조(그대로). Android 적응형 = 배경 #FFFFFF 단색 + 노랑 재료 전경, Android 12+ 시스템 시작 화면은 노랑 #FFD600 그대로. 웹 아이콘 파일명 `_v2` → `_v3`(`sw.js` v1.10.1). 스토어 1번 장·피처 그래픽·릴스 엔딩의 타일은 노랑 위에서도 흰 타일이 보여 **옅은 판으로 통일**(검정 바탕판은 선택지로 남김). 자세한 건 `brand/README.md`·`CHANGELOG.md` 「메인 앱 아이콘을 옅은(흰 배경) 판으로 교체」. **이 표·점검표의 「노랑 바탕이 기본」 서술은 11-07 시점 기록이다.**

---

## 0. 먼저 알아 둘 세 가지 (결론)

1. **위젯에는 로고가 없다.** iOS·Android 위젯 모두 시스템 기호(카메라·말풍선·달력)와 흰/진회색 카드만 쓴다. 위젯 갤러리·위젯 추가 목록에 보이는 앱 아이콘은 **앱 아이콘이 바뀌면 자동으로 따라간다**. 그래서 「위젯 미리보기가 옛 로고로 남는」 일은 없다. 다만 Android 위젯 미리보기 한 장(`widget_quick_square_preview.png`)이 **옛 이름(「요리 AI」·「AI 식단」)** 으로 남아 있어 로고와 별개로 고칠 거리다.
2. **앱 안 화면(React)은 앱 파일 안에 들어 있다**(`capacitor.config.ts` 의 `webDir: dist`). 헤더 워드마크·스플래시 아이콘은 **새 빌드를 올려야** 앱 사용자에게 바뀐다. 웹(Vercel)은 푸시하면 바로 바뀐다. → 「웹은 새 로고, 설치된 앱은 옛 로고」 기간이 생기는 건 **웹 배포를 앱 출시보다 먼저 할 때뿐**이다(완화책은 3장).
3. **현재 앱 아이콘 생성 스크립트는 새 마크를 못 만든다.** `store/make_store_assets.py` 의 `build_master_icon()` 은 「흰 집+그릇 글리프를 파랑 채널로 뽑고 대각 그라데이션을 다시 칠하는」 방식이라, 재료·받침·잎이 색이 다른 다색 마크에는 쓸 수 없다. 이 한 곳을 「새 마크 PNG(1024 풀블리드)와 전경 레이어를 직접 읽는」 방식으로 고쳐야 아래 「자동 생성」 32개가 모두 풀린다.

### 빠뜨리기 쉬운 곳 상위 10개
| 순위 | 곳 | 왜 빠뜨리기 쉬운가 |
|---|---|---|
| 1 | **스플래시 이미지 32개**(Android 26 + iOS 3 + `frontend/assets` 3) | 앱 아이콘 스크립트(`make_store_assets.py`)가 **안 만든다**. Android 26장 안에 **옛 아이콘이 노랑 바탕에 박혀** 있고, iOS 3장은 아예 Capacitor 기본 그림(브랜드 아님). 생성 도구(`@capacitor/assets`)도 설치돼 있지 않다 |
| 2 | **Android 알림 아이콘 `ic_stat_cookmatch` 5개** | 흰 단색 실루엣이어야 한다(색 있으면 흰 네모로 뭉개짐). 만든 스크립트가 저장소에 없다(CHANGELOG 에 「로고 글리프에서 추출」만 있음). 새 마크의 실루엣은 `fullset/notification_silhouette_white_1024.png` 로 준비돼 있음 |
| 3 | **PWA·웹 푸시 `public/cookmatch_icon.png` 한 파일이 열 곳에 쓰임** | manifest 8항목·`sw.js` 푸시 icon/badge·다운로드 페이지(아이콘·og:image·favicon). 이름을 그대로 두면 서비스워커·카톡/인스타 링크 미리보기 캐시에 **옛 그림이 오래 남는다** → 새 파일명 + `sw.js` `CACHE_NAME` 올리기 |
| 4 | **링크 공유용 OG 이미지가 아예 없다** | `index.html` 에 og 메타가 한 줄도 없고, `download.html` 만 아이콘 PNG 를 og:image 로 쓴다. 이번에 1200×630 공유 이미지를 새로 만들 좋은 기회 |
| 5 | **스토어 스크린샷 안에 헤더 워드마크가 박혀 있다** | 7/8장이 실제 앱 화면 캡처라 상단의 「CookMatch」가 보인다. **워드마크를 바꾸면 소스 재촬영 + 24장 재생성 + zip 3개**, 안 바꾸면 0 → 최대 변수 |
| 6 | **Google Play 피처 그래픽** `store/play_feature_graphic.png` | 안에 **옛 앱 아이콘**(64px 둥근 칩)이 들어 있다. 아이콘 스크립트가 같이 만들어 주지만 Play 콘솔에 따로 올려야 한다 |
| 7 | **소셜 로그인 동의 화면의 앱 로고**(카카오 개발자센터 앱 「Cookmatch」·구글 클라우드 OAuth 동의 화면·네이버 개발자센터) | 저장소 밖 콘솔이라 흔적이 없다. 로그인할 때마다 사용자가 본다. 구글은 로고를 올리면 확인 심사 대상이 될 수 있어 **먼저 지금 로고를 올려 뒀는지부터 확인** |
| 8 | **릴스 엔딩** `my-video/src/shared.tsx` `AppIcon`·`Wordmark`(→ `CtaOutro` 15개 영상) | 한 곳만 고치면 되지만 **이미 올린 릴스는 못 바꾸고**, 미게시분은 다시 렌더해야 한다. 릴스의 `Wordmark` 는 앱 헤더와 다른 글자(굵은 텍스트, 「Match」가 갈색 #D99A00) |
| 9 | **인스타 프로필 사진 = 앱스토어 「마케팅 URL」 페이지** | App Store 마케팅 URL 이 인스타 `@Cook._.match` 이다(`RELEASE_TODO.md:250`). 앱을 찾아온 사람이 처음 보는 로고. 사용자가 인스타 앱에서 직접 |
| 10 | **새 아이콘은 모서리가 없는 정사각형** → 화면 두 곳에서 모서리가 각져 보임 | 지금 `cookmatch_icon.png` 는 둥근 모서리가 그림에 구워져 있어서 `SplashScreen.tsx` 는 radius 없이 그대로 쓴다. 새 파일로 바꾸면 **스플래시가 네모 아이콘으로** 나온다(`download.html`·릴스 `AppIcon` 은 CSS radius 가 이미 있어 안전) |

---

## 1. 규모 (중복 제거 어림)

| 구분 | 파일 수 | 내용 |
|---|---|---|
| **자동 생성**(스크립트 입력부만 새로 짜면 풀림) | **32** | iOS AppIcon 1 · Android 런처 PNG 24 + adaptive xml 2 · 스토어 아이콘 2(appstore 1024·play 512) · 피처 그래픽 3(A·B·`play_feature_graphic`) |
| **반자동**(스크립트가 없어 새로 만들어 한 번에 변환) | **42** | 스플래시 32(Android 26·iOS 3·`frontend/assets` 3) · 알림 아이콘 5 · 웹/릴스용 아이콘 사본 4(`public`·`src/assets` 2·`my-video/public`) · 워드마크 PNG 1 |
| **손으로 고칠 것**(코드·설정·문서) | **약 28** | `capacitor.config.ts`·`colors.xml`·`styles.xml`·`index.html`·`manifest.json`·`sw.js`·`download.html`·`SplashScreen.tsx`·푸시 코드 2·`app.py`·`shared.tsx`·`make_store_assets*.py` 3·문서 6 외 |
| **새로 제작**(없던 것) | **약 5** | OG 공유 이미지 1 · 마스커블 아이콘 1 · 알림 흰 실루엣(시안에 있음) · 선택(모노크롬·iOS 다크/틴트 2) |
| **조건부**: 워드마크를 바꿀 때만 | **약 35** | 스크린샷 소스 7 재촬영 + 24장 재생성 + zip 3 + 쿠팡 제출 이미지 |
| **저장소 밖**(콘솔·앱에서 사용자) | **9곳** | Xcode·App Store Connect·Play Console·인스타·카카오·구글·네이버·KIPRIS·(선택) 스토어 실험 |

**비율(손 : 자동+반자동) ≈ 28 : 74 (약 27% : 73%).** 이 앞의 시안 문서가 말한 「80~100개 파일」은 맞는 규모지만 「손 10개 안팎」은 **낮게 잡혔다**(약 28개).

범례 — 빌드: **네이티브**(새 iOS/Android 빌드 필요) · **웹**(Vercel 푸시로 즉시) · **서버**(Railway 배포) · **스토어**(콘솔 업로드) · **없음**. 담당: **코드**(제가 코드로 가능) · **사용자**(Xcode·Play Console·App Store Connect·인스타 등에서 직접). 우선순위: **필수 · 권장 · 선택**.

---

## 2. 점검표 (영역별 번호 = 아래 순서 체크 때 참조)

| # | 영역 | 파일 경로(+자산) | 지금 모습 | 바꿀 내용 | 빌드 | 담당 | 위험·주의 | 우선 |
|---|---|---|---|---|---|---|---|---|
| **iOS** |||||||||
| I1 | iOS 아이콘 | `frontend/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`(1파일, 1024, **RGB·알파 없음**) | 노랑→주황 그라데이션 바탕 + 흰 집+그릇 | 새 마크 1024 풀블리드 정사각 PNG | 네이티브 | 코드(자동)+사용자(Xcode Archive·업로드) | **알파·투명·둥근 모서리 금지**(애플이 마스크). 스토어 아이콘이 이 파일에서 나오므로 빌드와 스토어는 자동으로 일치 — 단 **새 빌드가 승인돼야** 스토어 아이콘도 바뀜 | 필수 |
| I2 | iOS 18 다크/틴트 아이콘 | 같은 폴더 `Contents.json`(지금 `universal 1024` 한 항목, `appearances` 없음) | 변형 없음 — 다크 모드·틴트 모드에서도 같은 아이콘이 쓰임(틴트는 시스템이 자동 변환) | (선택) `dark`·`tinted` 변형 PNG 2장 + `Contents.json` 에 `appearances` 추가 | 네이티브 | 코드 | P12(검정 바탕)는 이미 어두워 dark 변형 생략 가능, P1·P14 는 어두운 변형 필요. 틴트는 회색조라 **잎 초록·노랑 구분이 사라짐**(재료/받침 명도 차가 필요) | 선택 |
| I3 | iOS 시작 화면 | `Assets.xcassets/Splash.imageset/splash-2732x2732{,-1,-2}.png`(3파일, 같은 그림) + `Base.lproj/LaunchScreen.storyboard`(imageView `Splash`, 배경 systemBackground=흰색) | **Capacitor 기본 placeholder**(흰 바탕+가운데 작은 파란 마크). 브랜드가 아님 | 새 아이콘(또는 워드마크)을 가운데에 둔 이미지로 교체. 배경색을 앱 스플래시(`SplashScreen.tsx` #fff)와 맞춤 | 네이티브 | 코드(이미지)+사용자(빌드) | 시작 화면(네이티브) → 앱 스플래시(React) 순서로 두 번 보이므로 **두 화면의 바탕색·아이콘 위치를 맞추지 않으면 깜빡임**. P12 면 검정/흰 선택 필요 | 권장 |
| I4 | Capacitor 설정 | `frontend/capacitor.config.ts`(`ios.backgroundColor '#FFFFFF'`, `SplashScreen.backgroundColor '#FFD600'`·`spinnerColor '#FFD600'`) | 노랑 스플래시색 | 새 시작 화면 바탕색에 맞춤 | 네이티브 | 코드 | `ios/App/App/capacitor.config.json`·`android/.../assets/capacitor.config.json` 은 `cap sync` 가 만드는 사본(저장소 추적 안 됨) — 직접 고치지 말 것 | 권장 |
| I5 | iOS 이름·권한 문구 | `ios/App/App/Info.plist`·`ios/App/CookMatchWidget/Info.plist`(`CFBundleDisplayName 쿡매치`, 카메라·사진 권한 문구) | 이름만 있고 로고 없음 | **변경 없음**(앱 이름을 안 바꾸면) | 없음 | — | 이름을 바꾸면 스토어 이름·위젯 이름까지 번짐 | 해당 없음 |
| I6 | iOS 위젯 | `ios/App/CookMatchWidget/CookMatchWidget.swift`·`CookMatchCalendarWidget.swift`(색 hex 하드코딩: 카드 #FFFFFF/#1D1D20, 잉크 #1A1A1E, 타일 #F1F1F4 …, 달력 `planRed #E5383B`) | **로고·이미지 없음**(SF Symbols). 위젯용 Assets 카탈로그·색 세트·미리보기 이미지도 **없음**(미리보기는 코드 `getSnapshot`) | **변경 없음**. 브랜드 노랑을 넣고 싶을 때만 `W`·`C` 색 구조체 수정 | 네이티브 | 코드 | 위젯 갤러리에 뜨는 앱 아이콘은 호스트 앱 아이콘이라 I1 로 자동. 위젯 이름·설명(`configurationDisplayName`: 「쿡매치 (가로)」 등)은 앱 이름을 안 바꾸면 그대로 | 선택 |
| I7 | iOS 알림 | (코드 없음) | 알림 아이콘 = 시스템이 **앱 아이콘**을 씀 | I1 로 자동 | 네이티브 | — | — | 해당 없음 |
| **Android** |||||||||
| A1 | 런처 아이콘(옛 런처·원형) | `android/app/src/main/res/mipmap-{ldpi,mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png`·`ic_launcher_round.png`(12파일, 36~192px) | 노랑 그라데이션 둥근사각/원 + 흰 글리프 | 새 마크 완성형 | 네이티브 | 코드(자동) | `make_store_assets.py` 가 22% 둥글게·원형 마스크로 만든다. 새 정사각 풀블리드 입력 필요(위 0장 3번) | 필수 |
| A2 | 적응형 아이콘(Android 8+) | 같은 폴더 `ic_launcher_background.png`·`ic_launcher_foreground.png`(12파일, 81~432px) + `mipmap-anydpi-v26/ic_launcher.xml`·`ic_launcher_round.xml`(2파일, 이 두 이미지를 가리킴) | 배경=그라데이션 PNG, **전경=흰 글리프만**(긴 변 50dp, 안전영역 66dp) | 배경=**단색**(P1 #FFD600 · P12 #1A1A1E · P14 #F7F7F5) 또는 이미지, 전경=**다색 마크 레이어**(투명). 큰 잎이 안전영역에 닿으면 전경을 더 줄임 | 네이티브 | 코드(자동) | 현재 스크립트는 전경을 흰색 한 장으로만 만든다 → **다색 전경으로 재작성**. 원형 마스크에서 **큰 잎 끝이 잘림**(`e9_final/README` 6장 한계) → 실제 마스크 미리보기 확인 | 필수 |
| A3 | Android 13 테마 아이콘 | 같은 xml 에 `<monochrome>` 없음 | 테마 아이콘 사용자는 옛 아이콘이 시스템 색으로 칠해지지 않고 그냥 표시 | (선택) 단색 실루엣 레이어 추가 | 네이티브 | 코드 | 알림용 흰 실루엣(A4)과 같은 그림을 재활용 가능 | 선택 |
| A4 | **알림 작은 아이콘** | `res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_stat_cookmatch.png`(5파일, 24~96px, **흰 단색+투명**) | 흰 집+그릇 실루엣 | 새 마크의 **흰 단색 실루엣**(재료+받침+잎을 한 덩어리로) | 네이티브 | 코드(변환 스크립트 신규) | 색이 하나라도 있으면 상태바에서 **흰 네모**로 뭉개진다. 29px 에서 잎·재료 구분이 사라지니 **단순화한 별도 실루엣** 필요. 만든 스크립트가 없음 | 필수 |
| A5 | 알림 강조색 | `res/values/colors.xml` `notification_accent #E0A800` + `AndroidManifest.xml` FCM `default_notification_color` | 진노랑 | 새 팔레트의 노랑 계열로(보통 그대로) | 네이티브 | 코드 | 아래 P1·P2 와 **값이 이미 어긋남**(부록 A-3) | 권장 |
| A6 | **스플래시 이미지** | `res/drawable/splash.png` + `drawable-night/splash.png` + `drawable-{land,port}-{,night-}{ldpi,mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/splash.png`(**26파일**, 다크용도 같은 그림) | **#FFD600 노랑 바탕 + 가운데 옛 아이콘(둥근 사각 그라데이션+집)** | 새 시작 화면 이미지로 일괄 교체 | 네이티브 | 코드(변환 스크립트 신규) | 아이콘 스크립트가 **안 만든다**. 원본 `frontend/assets/splash.png`(2732, #FFD600 + 옛 아이콘) 도 같이 | 필수 |
| A7 | 시스템 시작 화면(Android 12+) | `res/values/styles.xml` `AppTheme.NoActionBarLaunch`(`windowSplashScreenBackground #FFFFFF`, `windowSplashScreenAnimatedIcon` 투명, `android:background #FFFFFF`) | 흰 화면 한 장(아이콘 일부러 숨김) | **로고를 안 보이게 두는 현재 방침 유지**면 변경 없음. 시작 화면 색을 바꾸면 이 3곳도 같이 | 네이티브 | 코드 | 이 값과 `SplashScreen.tsx`(흰 배경)가 같아야 깜빡임 없음(2026-09-21 사용자 지적 이력) | 권장 |
| A8 | Android 위젯 | `res/layout/widget_{quick,quick_square,camera,calendar,calendar_big}.xml`·`res/xml/*_widget_info.xml`·`res/drawable/ic_widget_{camera,chat,plan}.xml`·`widget_*_bg.xml`·`values{,-night}/colors.xml`(widget_card #FFFFFF/#1D1D20 등)·`strings.xml`(위젯 이름·설명) | **로고 없음**(시스템 기호+흰 카드). 브랜드 노랑도 안 씀 | **변경 없음**. 선택: 위젯에 브랜드 포인트를 넣을 때만 `colors.xml` | 네이티브 | 코드 | 미리보기 `previewImage` 4장(`res/drawable-nodpi/widget_{calendar,calendar_big,camera,quick_square}_preview.png`)은 **화면 캡처 — 로고 없음**. 3×1 가로는 레이아웃 미리보기 | 선택 |
| A9 | 위젯 미리보기 한 장이 옛 이름 | `res/drawable-nodpi/widget_quick_square_preview.png`(452×452) | 「**요리 AI**」·「재료 찍기」·「**AI 식단**」 — 지금 이름은 「쿡 픽」·「식단 짜기」 | 새로 캡처해 교체(로고와 무관, 지금 고쳐도 됨) | 네이티브 | 사용자(에뮬레이터 캡처)/코드 | 위젯 추가 화면에서 보이는 그림이 앱과 다르면 신뢰 하락 | 권장 |
| A10 | 매니페스트·빌드 | `AndroidManifest.xml`(`icon @mipmap/ic_launcher`, `roundIcon`, FCM icon `@drawable/ic_stat_cookmatch`), `app/build.gradle`(`versionCode 14`·`versionName 1.0.13`) | 이름으로 참조 | 파일명을 안 바꾸면 **변경 없음**. 새 빌드 때 `versionCode`·`versionName` 올림 | 네이티브 | 코드 | 저장소 `build.gradle` 은 1.0.13/14 인데 문서(`RELEASE_NOTES.md`)는 「다음 = Android 1.0.14(15)」 — 빌드 때 올리는 방식이면 문제없음, 아니면 확인 | 필수 |
| A11 | Android 죽은 템플릿 | `res/drawable/ic_launcher_background.xml`(초록 #26A69A 격자)·`res/drawable-v24/ic_launcher_foreground.xml`(안드로이드 로봇)·`res/values/ic_launcher_background.xml`(#FFFFFF) | Android Studio 기본 템플릿 잔재. **아무 곳도 참조 안 함**(`mipmap` 쪽이 실제) | 지울 것(헷갈림 방지) | 네이티브 | 코드 | 지우기 전 빌드로 확인 | 선택 |
| **Capacitor 원본·푸시 코드** |||||||||
| C1 | Capacitor 원본 | `frontend/assets/icon.png`(1024 RGBA, **둥근 모서리 투명**)·`splash.png`·`splash-dark.png`(2732, **두 파일이 완전히 같은 그림**) | 옛 아이콘 | 새 정사각 풀블리드 아이콘(모서리 없음) + 새 스플래시. 다크 변형을 따로 둘지 결정 | 네이티브(생성 재료) | 코드 | `@capacitor/assets` 가 `package.json` 에 없다 → 이 폴더는 지금 **어떤 도구의 입력도 아님**(스토어 스크립트의 `ICON_SRC` 만 읽음) | 필수 |
| C2 | 푸시 발송 코드 | `backend/push_send.py:28-29`(`FCM_ICON ic_stat_cookmatch`, `FCM_COLOR #FFD600`)·`scripts/send_expiry_push_notifications.py:80-81`(`#E0A800`) | 아이콘 이름 참조 + 색 | 아이콘 이름을 안 바꾸면 변경 없음. **두 색이 서로 다르다**(앱 주석: FFD600 은 밝은 알림 배경에서 안 보임) | 서버 | 코드 | 부록 A-3 참고 — 로고와 무관하게 통일 권장 | 권장 |
| **웹 / PWA** |||||||||
| W1 | 웹 아이콘 본체 | `frontend/public/cookmatch_icon.png`(1024×1022, 투명 모서리) | 옛 아이콘 | 새 아이콘 **새 파일명**으로(예: `cookmatch_icon_v2.png`) | 웹 | 코드 | 이 한 파일이 아래 W3~W6 열 곳에서 쓰임. 같은 이름 그대로 두면 서비스워커 `CacheFirst`·카톡/인스타 미리보기가 옛 그림을 오래 보여줌 | 필수 |
| W2 | 앱 안 아이콘 | `frontend/src/assets/cookmatch_icon.png`(W1 과 바이트 동일)·`쿡매치어플아이콘.png`(**또 하나의 동일 사본, 어디서도 안 씀**) | 옛 아이콘 | 새 아이콘으로 교체, 미사용 사본은 삭제 | 웹+네이티브 | 코드 | `index.html`(파비콘·apple-touch)과 `SplashScreen.tsx` 가 이 파일을 쓴다(Vite 가 해시 파일명으로 빌드 → 캐시 문제 없음) | 필수 |
| W3 | 웹 `<head>` | `frontend/index.html`: favicon 1줄·apple-touch-icon 4줄(기본·152·167·180 모두 같은 파일)·`theme-color #FFD600`·`apple-mobile-web-app-title 쿡매치`·title/description | 옛 아이콘, **OG/트위터 메타 없음** | 아이콘 교체, 크기별 apple-touch(180 필요)·`theme-color`(P12 이면 상태바색 재고)·**OG 메타 신설** | 웹 | 코드 | iOS 사파리는 apple-touch-icon 에 알파 있으면 검정으로 채움 → **알파 없는 RGB** | 필수 |
| W4 | PWA 매니페스트 | `frontend/public/manifest.json`: 아이콘 8항목(72~512, **전부 1024짜리 한 파일**, `purpose "any maskable"`)·`background_color`·`theme_color #FFD600`·`shortcuts` 아이콘 3개 | 한 파일을 8가지 크기로 속임. 숏컷 아이콘 경로(`/navigator_*.png`)는 **실제로 없는 파일** | 192·512 실제 크기 파일 + **마스커블 전용(안전영역 안쪽 여백) 파일을 분리**. 숏컷 아이콘 정리 | 웹 | 코드 | 새 마크는 캔버스 86%를 채워 **마스커블 원형 마스크에 잘림** → `any`(풀블리드)·`maskable`(여백) 두 벌 필요 | 필수 |
| W5 | 서비스워커 | `frontend/public/sw.js`: `CACHE_NAME 'cookmatch-v1.9.5'`·`urlsToCache`(`/src/assets/...` 개발 경로)·웹 푸시 `icon`·`badge` = `/cookmatch_icon.png`(:176-177) | 푸시 뱃지가 **컬러 아이콘**(뱃지는 투명+흰 단색이어야 함) | `CACHE_NAME` 올림(안 올리면 설치된 PWA 가 옛 아이콘 유지), 푸시 icon→새 파일, **badge→흰 단색 실루엣(A4 와 같은 그림)** | 웹 | 코드 | 이 값을 안 올려서 예전 배포가 반영 안 된 이력이 주석에 있음 | 필수 |
| W6 | 다운로드 페이지 | `frontend/public/download.html`: `<img class="icon" src="/cookmatch_icon.png">`(96px, radius 22)·`og:image https://refrigerator-code.vercel.app/cookmatch_icon.png`·`<link rel="icon">`·`:root --brand #FFD600`·`.primary` 버튼 | 옛 아이콘. 인스타 프로필·릴스·PDF 가 모두 여기로 옴 | 아이콘·og:image(새 파일명)·(선택) 배경/버튼색 | 웹 | 코드 | **스토어 아이콘이 바뀌는 날 같이** 바꿔야 어긋남이 적다(3장). og:image 는 새 URL 이어야 인스타·카톡 캐시가 풀림 | 필수 |
| W7 | **OG 공유 이미지(신설)** | (없음) → `frontend/public/og_cookmatch.png` 1200×630 | 루트 `/` 링크를 공유하면 이미지 없는 미리보기 | 새 로고+한 줄 카피 이미지 제작, `index.html` 에 `og:title/description/image`·`twitter:card` | 웹 | 코드 | 레시피 단위 공유는 SPA 라 서버가 OG 를 못 내려줌(동적 OG 엔드포인트 없음) — 루트 공통 이미지만 가능 | 권장 |
| W8 | 웹 잔재 | `frontend/public/index.html`(CRA 잔재, `logo192.png`·`favicon.ico` 참조 — 파일 없음)·`public/vite.svg`·`src/assets/react.svg`·`public/workbox-config.js` | 로고와 무관한 죽은 파일 | 삭제 후보 | 웹 | 코드 | 지우기 전 빌드·배포 확인 | 선택 |
| **앱 안 화면(React) — 로고 이미지가 실제로 쓰이는 곳은 3곳뿐** |||||||||
| R1 | 헤더 워드마크 | `frontend/src/assets/냉털이 로고 white.png`(**이름과 달리 영문 「CookMatch」 워드마크**, 2860×484, 가는 회색 #3B4345 투명 PNG) → `components/TopNavBar.tsx:3,88`(높이 20) · `components/SplashScreen.tsx:3,157`(높이 28~38) | 가는 영문 고딕 | 새 워드마크로 같은 파일 교체(또는 신규 파일명) — **워드마크를 바꿀지는 사용자 결정** | 네이티브+웹 | 코드 | 워드마크가 바뀌면 **스토어 스크린샷 7장 재촬영**(2.S3)·릴스 `Wordmark`·이메일까지 번짐. 높이 20px 에서 읽히는 굵기 확인 | 필수 |
| R2 | 앱 스플래시 | `components/SplashScreen.tsx`(흰 배경 `#ffffff`, 아이콘 `clamp(124px,36vw,168px)` **radius 없음**, 워드마크, 「누적 레시피 수」 숫자) | 둥근 모서리가 그림에 구워진 노랑 아이콘 + 워드마크 | 새 아이콘은 **모서리 없음** → `borderRadius: '22%'` 추가(또는 마크만 투명 배경으로 쓰기) | 네이티브+웹 | 코드 | I3(iOS 시작 화면)·A6/A7(Android) 과 바탕색·아이콘 위치를 맞춤 | 필수 |
| R3 | 로고 import 만 남은 곳 | `pages/MyPage.tsx:22`·`pages/IngredientDetail.tsx:11`(`logoImg` 를 가져오기만 하고 안 씀) | 죽은 import | 지움(파일명 정리 때 걸림) | 없음 | 코드 | — | 선택 |
| R4 | 옛 이름 로고 페이지 | `pages/FridgeSelect.tsx:4,91`(`냉털이 로고.png` = 「냉털이 JUST DO EAT」 1024×1024), 라우트 `/fridge-select`(`AppRouter.tsx:222`) — **어디서도 링크하지 않음** | 옛 이름·옛 디자인의 잔재 | 페이지·이미지·라우트 삭제 | 웹+네이티브 | 코드 | 직접 주소로 들어가면 지금도 열림 | 권장 |
| R5 | PWA 설치 안내 5파일 | `components/PWAInstallGuide.tsx:130`·`PWAInstallPrompt.tsx:73`·`PWAInstallSection.tsx:79`·`PWATestPage.tsx:46,54`·`utils/pwa.ts:97-98`(`src="/src/assets/cookmatch_icon.png"` 하드코딩) | **개발 서버에만 있는 경로**라 빌드본에선 이미지가 깨짐. 5개 컴포넌트는 **어디에도 마운트되지 않음**(서로 참조만) | 로고 교체 대상이 아니라 **삭제 후보** | 웹 | 코드 | 지우면 `utils/pwa.ts` 의 일부 함수만 `OfflineIndicator` 가 계속 씀 → 함수 단위로 확인 | 권장 |
| R6 | 브랜드 색 토큰 | `src/index.css :root`(`--brand #FFD600`·`--brand-light #FFE45C`·`--brand-strong #F2C200`·`--brand-soft #FFF6C2`·`--brand-on-soft #6B5200`, `var(--brand*)` 참조 28곳) + 하드코딩 `#FFD600` **80곳(약 25개 파일: Admin 14·WeeklyPlan 11·CookingCalendar 11 …)** + `tailwind.config.js`(`bg-[#FFD600]` safelist·`brand.DEFAULT`·`customYellow`) | 노랑 #FFD600 + 잉크 #1A1A1E | 시안의 노랑·검정은 **같은 값**(`make_logo_proposals.py` BRAND=#FFD600, INK=#1A1A1E) → 노랑을 그대로 쓰면 **변경 0**. 시안 초록(`G2` #1E9252 진초록 등)을 앱 색 토큰에 추가할지 선택 | 네이티브+웹 | 코드 | **충돌 판단**: P1 은 앱 UI(노랑 버튼·흰 배경)와 같은 노랑 바탕이라 가장 어울림 · P12(검정 바탕 아이콘)는 UI 에 검정 바탕 면이 거의 없어 아이콘만 따로 놂 · P14(옅은 바탕)는 흰 UI 안에서 아이콘 모서리가 안 보임. 하드코딩 80곳을 바꿀 일은 노랑 값 자체를 바꿀 때만 생김 | 권장 |
| R7 | 로고가 없는 화면(확인 완료) | 로딩 `LoadingIndicator.tsx`(점 3개)·에러 `ErrorBoundary.tsx`(노랑 버튼만)·빈 화면 `nodata.png`·로그인 `Login.tsx`(소셜 버튼 이미지만)·가입 `Signup.tsx`·사용 가이드 `GuideOverlay.tsx`(노랑 색만)·`LegalPage.tsx`·`AccountDeletion.tsx`(텍스트 「쿡매치 (CookMatch)」)·`Admin.tsx`(텍스트 「쿡매치 어드민」)·`CookModeSheet.tsx`(노랑 색만) | 로고 이미지 없음 | **변경 없음** | 없음 | — | 로그인 화면에 로고가 **없다**는 점은 브랜드 인지 기회를 놓치는 것(별개 개선) | 해당 없음 |
| R8 | 쿡 픽·쿡 코치 아바타 | `components/CookCoach.tsx:80-86`(`HatCircle` = 흰 원 + 셰프 모자 선 아이콘)·`ui/Icons.tsx`(`ChefHatIcon`·`SparklesIcon`) | 로고와 무관한 **선 아이콘** | 로고 가족(재료+받침 도형)으로 맞출지 선택. 맞추지 않으면 변경 없음 | 네이티브+웹 | 코드 | 아이콘 문법(가는 선)과 새 로고(면)가 다름 — 억지로 맞추지 말 것 | 선택 |
| R9 | 공유 | `components/HouseholdSection.tsx:199-208`(`navigator.share` 텍스트만)·`RecipeShareHost.tsx`(링크 복사·가족 푸시) | 카카오 SDK·공유 카드 이미지 **없음** | **변경 없음**. 링크 미리보기는 W7 의 OG 로만 | 없음 | — | — | 해당 없음 |
| **백엔드·이메일·문서** |||||||||
| B1 | 인증 코드 메일 | `backend/app.py:2184-2206`(`send_verification_email`: 제목 `[Cookmatch] 이메일 인증 코드`, 본문 「Cookmatch 인증 코드입니다」, 로고·브랜드색 없음) | 로고 없는 평문 HTML. **철자가 「Cookmatch」**(앱은 「쿡매치」·「CookMatch」) | 철자 통일(「쿡매치」). 로고를 넣을지는 선택(넣으면 외부 호스팅 이미지 URL 필요 — 메일 클라이언트는 `/src` 경로를 못 읽음) | 서버 | 코드 | 비밀번호 재설정 메일 템플릿은 **따로 없다**(재설정도 이 인증 코드 메일을 재사용) — 이메일은 이 1종뿐 | 권장 |
| B2 | 소셜 로그인 복귀 페이지 | `backend/app.py:1471-1484`(제목 「쿡매치 로그인」, `a{background:#FFD600}` 노랑 버튼) | 로고 없음, 노랑 버튼 | 노랑 유지면 변경 없음 | 서버 | 코드 | — | 선택 |
| B3 | OG 엔드포인트 | (서버에 share/og/preview 라우트 **없음** 확인) | — | W7 로 대체 | — | — | — | 해당 없음 |
| B4 | 레시피 PDF | `scripts/make_dm_pdf.py:41,48`(`--brand` 노랑 상자·검정 버튼 「여기를 누르면 쿡매치 받기」)·`scripts/hub_post_files/dm/{camping_alioolio,leftover_ham_alioolio}.{html,pdf}`(2편)·`store/RECIPE_PDF_GUIDE.md` 「노란 상자」 | **PDF 에 로고는 없고** 노랑 상자+글자만 | 노랑 유지면 변경 0. PDF 에 새 로고를 넣을지는 선택(워드마크 한 줄) | 없음 | 코드 | 이미 DM 으로 보낸 PDF 는 그대로. 새 편부터 | 선택 |
| B5 | 어드민 | `frontend/src/pages/Admin.tsx`(텍스트·브랜드색 14곳) | 로고 없음 | 변경 없음 | — | — | — | 해당 없음 |
| **스토어 자산·안내** |||||||||
| S1 | 스토어 아이콘 2종 | `store/icons/appstore_icon_1024.png`(RGB)·`store/icons/play_icon_512.png`(RGBA) | 옛 아이콘 | 스크립트가 새 아이콘으로 자동 생성 | 스토어 | 코드(생성)+사용자(업로드) | **App Store**: 아이콘은 **빌드 안의 I1 에서 나오고** 이 파일은 기록용(둘이 같아야 함). **Play**: 512 PNG(32비트, ≤1MB)를 콘솔에서 따로 올리고, 런처 아이콘은 새 빌드(A1~A2) — **둘이 어긋나면 안 됨** | 필수 |
| S2 | Play 피처 그래픽 | `store/play_feature_graphic.png`(1024×500 RGB, = `store/feature_options/feature_A.png` 검정 바탕)·`feature_B.png` | 왼쪽 위 **옛 아이콘(64px 둥근 칩)+「쿡매치」+카피**, 오른쪽 실제 앱 화면 2장(**앱 화면 안 헤더에 옛 워드마크**) | 아이콘 칩 교체(스크립트 `_feature_graphic` 자동) | 스토어 | 코드+사용자(콘솔 업로드) | 이미지 안에 홍보 문구·순위 금지(Play 메타데이터 정책 — 지금 카피는 해당 없음). 워드마크를 바꾸면 안의 앱 화면 캡처도 교체 | 필수 |
| S3 | 스크린샷 | `store/screenshots_v3/{play 1080×1920, ios 1290×2796, ios_1206x2622}` 각 8장 = 24 (+`alt` 3), 구버전 `store/screenshots`(v1)·`screenshots_v2` 각 24, `store/upload_packages/*.zip` 11개 | `01_brand` 는 **워드마크 PNG** 사용, 나머지 7장은 **실제 앱 캡처**(`store/sources/*_v3.png` 7+`list_top_v3.png`)라 상단 **헤더에 옛 워드마크**가 보임. 현재 스토어에 올라간 것은 v1 인지 v3 인지 **문서가 불명확**(`STORE_LISTING.md` 표는 v1, 「v3 를 올리는 것을 추천」) | 워드마크 **유지**: 변경 0(아이콘은 장 안에 안 나옴 — v3 첫 장은 글자만). 워드마크 **변경**: 소스 7 재촬영(셀레늄 헤드리스 430×932@3x) → 24장 재생성 → zip 3 → 스토어 업로드 | 스토어 | 코드(재생성)+사용자(업로드) | **App Store Connect 는 여러 장을 한꺼번에 올리면 순서가 섞임 → 한 장씩**. 스크린샷이 앱 UI와 어긋나면 애플 2.3(정확한 메타데이터) 위반 소지 | 조건부 |
| S4 | 스토어 문구 | `store/STORE_LISTING.md`(이름 「쿡매치 - 냉장고 레시피」·부제·짧은/긴 설명·키워드(「냉털」「냉털이」 의도적 포함)·그래픽 표)·`store/paste/ios-{desc,keywords,promo,subtitle,whatsnew}.txt` | 로고를 언급하지 않음 | 이름·워드마크를 안 바꾸면 **변경 0**. `ios-whatsnew`·Play 「이 버전의 새로운 기능」에 「앱 아이콘이 새로워졌어요」 한 줄 권장 | 스토어 | 코드(문서)+사용자(콘솔) | App Store 설명·키워드는 **새 버전 제출 때만** 수정 가능(프로모션 텍스트는 상시) | 권장 |
| S5 | Play 신청서·답변 문서 | `store/PLAY_CONSOLE_ANSWERS.md`·`PLAY_PRODUCTION_APPLICATION.md` | 아이콘·브랜드에 대한 **답변 없음**(테스터 피드백의 「아이콘 화면」 언급은 과거 사실) | **변경 없음** | 없음 | — | — | 해당 없음 |
| S6 | Play Console | (콘솔) 앱 아이콘 512·피처 그래픽·스크린샷·**프로모션 영상: 없음**·스토어 등록정보 실험 | — | 아이콘·피처 그래픽·(조건부) 스크린샷 업로드. **아이콘 A/B(스토어 등록정보 실험)는 가능하지만 이번엔 비추천** | 스토어 | 사용자 | 실험 중인 아이콘은 설치 뒤 런처 아이콘과 다르게 보여 혼란. 실험은 새 빌드가 나간 **뒤** 「아이콘 vs 아이콘」이 아니라 스크린샷·피처 그래픽에 쓰는 편이 안전 | 필수 |
| S7 | App Store Connect | (콘솔) 아이콘=빌드·스크린샷 6.9"(1290×2796)·6.5"/중형(1206×2622)·**앱 미리보기 영상: 없음**·마케팅 URL=인스타·지원 URL=웹 루트·심사 메모·제품 페이지 최적화(PPO) | — | 새 빌드 제출+(조건부) 스크린샷. **PPO 로 아이콘 A/B 를 하려면 대체 아이콘이 앱 바이너리 안에 들어 있어야** 한다(애플 규칙 — 내 지식 기준, 제출 전 공식 문서 확인) | 스토어 | 사용자 | 아이콘은 **새 빌드를 올려야만** 바뀌고 승인 대기 중엔 스토어에 옛 아이콘이 계속 보임 | 필수 |
| S8 | 개인정보처리방침·이용약관 | `frontend/src/pages/LegalPage.tsx`(`/privacy`·`/terms`; 로고 없음, 「서비스명: 쿡매치 (CookMatch)」:312) | 텍스트뿐 | 이름을 안 바꾸면 **변경 없음** | 웹 | — | 서비스명을 바꾸면 방침·약관·삭제 안내(`AccountDeletion.tsx`)·스토어 3곳 동시 수정 | 해당 없음 |
| S9 | 상표 | KIPRIS(kipris.or.kr) 「쿡매치」 문자·새 도형 선행 상표 | — | 검색 후 필요하면 출원(소프트웨어 앱·서비스 분류 중심, 변리사 상담 권장) | — | 사용자 | **Play 에서 `com.cookmatch.app` 패키지명을 다른 개발자가 이미 쓰고 있음**(`STORE_LISTING.md`) → 「CookMatch」 이름이 이미 남에게 쓰이고 있다는 신호. 로고 확정 **전에** 한 번 검색 | 필수 |
| S10 | 소셜 로그인 동의 화면 | 카카오 개발자센터 앱 「Cookmatch」(ID 1359747, `MOBILE_APP_GUIDE.md:277`)·구글 클라우드 My First Project 의 OAuth 동의 화면(`CookMatch Web Client_web`, 게시 상태 프로덕션)·네이버 개발자센터(검수 승인 대기 기록) | 앱 아이콘/로고를 올렸는지 **저장소에 기록 없음** | 올려 둔 곳만 새 아이콘으로 교체 | — | 사용자 | 구글은 동의 화면 로고를 올리면 브랜드 확인 심사가 걸릴 수 있음 → **안 올려 뒀다면 그대로 두는 것이 안전** | 권장 |
| **마케팅·영상·SNS** |||||||||
| M1 | 릴스 엔딩 | `my-video/src/shared.tsx:81-86`(`AppIcon`: `cookmatch_icon.png`, radius 22%)·`:88-92`(`Wordmark`: **텍스트** 「Cook」+「Match」 #D99A00)·`:140-141,230`(`CtaOutro`)·`:23` `YELLOW #FFD600`·`my-video/public/cookmatch_icon.png` → `CtaOutro` 를 쓰는 편 15개 + `ReelOverview`·`CookMatchTeaser` 직접 | 옛 아이콘+텍스트 워드마크 | 아이콘 PNG 교체(radius 는 이미 있음), 워드마크 텍스트→새 워드마크 | 없음 | 코드 | **이미 올린 릴스(19편 이상)는 못 바꿈**, `my-video/out` 의 렌더본(63개 mp4, 추적 안 됨)은 미게시분만 다시 렌더. 릴스 워드마크가 앱 헤더와 이미 다름 → 이번에 통일 | 권장 |
| M2 | 릴스 문서·규칙 | `store/REEL_FORMATS.md`(「쿡매치 로고·유도 화면」)·`my-video/COOKING_REEL_GUIDE.md`(`CtaOutro`)·`my-video/CLAUDE.md` | 로고 규칙 문장 | 새 로고에 맞게 문구만 | 없음 | 코드 | — | 선택 |
| M3 | 인스타 프로필 사진 | 인스타 앱 `@Cook._.match`(= App Store 마케팅 URL) | 옛 아이콘일 가능성(**확인 못 함**) | 새 아이콘(원형 크롭에서 큰 잎이 잘리지 않는지 확인) | — | 사용자 | 원형 크롭 — A2 와 같은 확인 | 필수 |
| M4 | 스레드 | `store/THREADS_GUIDE.md:75` 「프로필 사진: 앱 아이콘은 쓰지 않는다」 | 사람 계정 | **변경 없음** | — | — | — | 해당 없음 |
| M5 | DM·캡션·고정 문구 | `store/INSTAGRAM_AUTO_DM.md`·DM 레시피 카드 `store/cooking_recipe_dm/ep3_*.png`·`COOKING_REEL_CAPTIONS.md`·`REEL_CAPTIONS.md` | **로고 규칙·로고 이미지 없음** | **변경 없음** | — | — | — | 해당 없음 |
| M6 | 광고 소개서 | `AD_BRIEF.md`:385-387(「마스코트 **냉털이**(`냉털로고블랙/화이트.png`)」·워드마크 `쿡매치글씨로고.png` — **그 파일은 저장소에 없음**)·`★ 쿡매치 광고 이미지, 기획안… 폴더/쿡매치 AD_BRIEF.md`(사본) | 옛 이름·옛 로고 서술 | 새 로고·워드마크로 서술 갱신 | 없음 | 코드 | 이 문서는 제3자(AI 포함)에게 그대로 넘기는 용도라 옛 서술이 남으면 **옛 로고로 광고 소재가 만들어짐** | 권장 |
| M7 | 쿠팡 | `store/coupang/coupang_partners_0{1,2}_*.png`(파트너스 활동 심사 제출 캡처)·`frontend/public/coupang-banner.html`(쿠팡 위젯 중계) | 제출용 과거 캡처(앱 화면에 옛 워드마크)·우리 로고 없음 | **변경 없음**(다시 제출할 때만 새 캡처) | — | — | — | 해당 없음 |
| M8 | 쿠킹 릴스 훅 썸네일 | `my-video`(노랑 큰 질문 글자, `YELLOW #FFD600`) | 색만 사용 | 노랑 유지면 변경 0 | — | — | P12 로 아이콘이 검정이 돼도 릴스 썸네일의 노랑은 그대로 둬도 어울림 | 해당 없음 |
| **개발 도구** |||||||||
| D1 | 아이콘 생성기 | `store/make_store_assets.py`: `ICON_SRC = frontend/assets/icon.png`·`build_master_icon()`·`make_icons()`(I1·A1·A2·S1·S2 를 한 번에 씀)·`_feature_graphic()` | 흰 글리프 추출+대각 그라데이션 재합성 | **입력부 재작성**: 새 마크(풀블리드 RGB)·전경 다색 레이어·배경 단색을 읽도록 | — | 코드 | 이 한 곳이 자동 32개의 열쇠. 알파 없는 RGB 로 저장(애플), Play 는 RGBA 32비트 | 필수 |
| D2 | 파생 스크립트 | `store/make_store_assets_v2.py:404`(`appstore_icon_1024.png` 읽음 — v2 브랜드 장)·`make_store_assets_v3.py:372`(`WORDMARK = frontend/src/assets/냉털이 로고 white.png`)·`:376-461`(`render_brand`) | 옛 파일명 참조 | 워드마크 파일명을 바꾸면 이 경로도 | — | 코드 | — | 권장 |
| D3 | 변환 스크립트 신설 | (없음) 예: `store/make_app_assets.py` | 스플래시 32·알림 5·웹 사본 4·OG·마스커블이 **어떤 스크립트에도 없음**, `@capacitor/assets` 미설치 | 새 마크 한 장 → 위 파일들을 **한 번에** 만드는 스크립트 1개 | — | 코드 | 이걸 만들어 두면 계절 아이콘·재수정 때 재사용 | 필수 |
| D4 | 색 하드코딩 위치 | `values/colors.xml`·`values-night/colors.xml`·위젯 Swift `W`/`C` 구조체·`CalendarWidgetProvider.java:276`(식구 기본색 `0xFFFFD600`)·푸시 스크립트 2·`index.css`·`tailwind.config.js` | 노랑·잉크 hex 가 여러 곳 | 팔레트를 안 바꾸면 변경 0 | — | 코드 | 한 곳(`index.css`)만 「한 번만 바꾸면 전부」 구조이고 나머지는 **따로 고쳐야** 함 | 참고 |

---

## 3. 후보별로 달라지는 곳 (P1·P12·P14)

| 항목 | P1 노랑 바탕 | P12 검정 바탕 | P14 옅은 바탕 |
|---|---|---|---|
| 지금 앱과의 연속성 | 노랑 바탕 그대로 → **가장 큼** | 노랑이 바탕→받침·잎으로 이동, 바탕은 검정 | 바탕이 흰 계열 → 홈 화면 존재감 낮음 |
| 앱 UI(노랑 #FFD600·흰 배경)와 어울림 | 가장 잘 어울림 | 아이콘만 어두움(앱 안 검정 면이 거의 없음) | 흰 UI 안에서 모서리가 안 보임 |
| 적응형 아이콘 배경(A2) | #FFD600 단색 | #1A1A1E 단색 | #F7F7F5 단색 |
| 스플래시(I3·A6·R2) | 노랑 스플래시 유지 가능(현재와 같음) | 흰 바탕+검정 아이콘 또는 검정 바탕 — **`SplashScreen.tsx` 흰 배경과 맞추는 결정 필요** | 흰 스플래시와 거의 같은 색이라 자연스러움 |
| `theme-color`·manifest `background_color`(W3·W4) | #FFD600 그대로 | 상태바를 검정/노랑 중 선택 | 흰색 계열로 변경 고려 |
| 알림 실루엣(A4)·뱃지(W5) | 후보와 무관하게 **흰 단색 실루엣**(모두 같은 파일) | 같음 | 같음 |
| 스토어 512 아이콘·Play 목록 | 노랑이 목록에서 눈에 띔 | 검정이 눈에 띄나 어두운 배경화면·다크 모드에서 가장자리 약함(`e9_final/README` 6장) | **흰 목록에서 윤곽이 사라짐**(Play 가 모서리를 마스크·그림자 처리해도 약함) |
| iOS 다크/틴트(I2) | 어두운 변형 새로 필요 | 거의 그대로(이미 어두움) | 어두운 변형 필요 |
| 시안 문서의 위계 점수 | 재료↔바탕 1.4:1(약함) | 재료↔바탕 17.3:1 | 재료↔바탕 1.3:1(약함) |

(위 표의 대비비율은 `e9_final/README.md`·`finalists/finalists_metrics.csv` 의 계산값을 인용했다. 「눈에 띔」 판단은 눈 판단이며 실기기 확인 전이다.)

---

## 4. 적용 순서 (체크박스)

### 왜 기존 빌드(iOS 1.0.11/18 · Android 1.0.14/15)에 넣지 않고 다음 빌드(iOS 1.0.12/19 · Android 1.0.15/16)로 미루는가
- **그 빌드는 이미 「마이페이지 개편·쿡 코치·사진 확인 창 단순화…」가 33차까지 쌓인 기능 묶음**(`RELEASE_NOTES.md` 「다음 버전 — 쌓는 중」)이다. 여기에 파일 100개 규모의 이미지·설정 교체를 섞으면 **문제가 생겼을 때 기능 탓인지 로고 탓인지 가를 수 없고** 로고만 되돌릴 방법도 없다(스토어 아이콘은 되돌리기도 새 빌드).
- **아이콘·피처 그래픽·(조건부) 스크린샷·스플래시·알림 아이콘이 한 세트로 같이 나가야** 어긋남이 없다. 지금은 스토어 자산 3종(S1·S2·S3)이 새 마크로 아직 안 만들어졌고 생성 스크립트(D1)도 못 쓰는 상태다.
- **최종안이 아직 하나로 안 정해졌고 상표 검색도 전**이다(S9). 아이콘은 한 번 나가면 사용자 인지에 남는다.
- 심사 쪽: 아이콘·스크린샷·UI 가 서로 달라 보이면 애플 정확한 메타데이터 확인이 길어질 수 있다. 기능 업데이트와 로고 교체를 **같은 날 같은 세트로** 내거나(권장: 로고만의 가벼운 업데이트로 분리) 기능 묶음을 먼저 내보내 안정화한 뒤에 로고를 낸다.

### 웹 로고와 앱 아이콘이 어긋나는 기간의 완화책
1. **웹(Vercel) 로고 교체를 앱 출시일에 맞춘다.** 코드(2단계)는 미리 만들어 두되 새 파일·새 `<img>` 는 **환경 변수 한 개(예: `VITE_NEW_BRAND`)나 별도 브랜치**로 잠가 두고, 출시 당일에 켠다. (앱 안 화면은 어차피 앱 파일에 들어 있어 **새 빌드와 함께만** 바뀐다 → 앱 안 로고와 홈 화면 아이콘은 항상 같은 버전.)
2. **출시 당일 같이 바꿀 것(한 시간 안)**: Play 콘솔 아이콘·피처 그래픽 → `download.html`·웹 아이콘·OG(W1~W7) → 인스타 프로필 사진 → 신규 릴스 엔딩. 먼저 바뀌어야 하는 것은 **iOS/Android 새 빌드가 사용자에게 보이기 시작한 뒤**.
3. **iOS 는 심사 승인 → 자동 출시 순서**라 승인 날짜를 못 맞춘다 → Android 와 날짜를 맞추려면 iOS 를 「수동 출시」로 걸고 둘 다 통과한 날 같이 푼다.
4. **전환 안내**: 새 버전 출시 노트에 「앱 아이콘이 새로워졌어요」 한 줄(`ios-whatsnew`·Play 새로운 기능), 인스타에 컷 한 장. 노랑을 유지하는 P1 이면 어긋남이 가장 작고, P12·P14 는 크다.
5. **서비스워커**: `CACHE_NAME` 을 올려야 설치된 PWA 도 같은 날 바뀐다(W5).

### 단계별 체크리스트
**1단계 — 준비 (1~2일, 상표 출원은 대기 안 함)**
- [x] 최종안 확정: P1 + 형태 E9(g) — **메인 아이콘은 P1 의 옅은 판으로 확정(2026-11-08)**
- [ ] KIPRIS 에서 「쿡매치」·「CookMatch」 문자 + 새 도형(그릇+재료+잎) 선행 상표 검색, 필요하면 변리사 상담(S9)
- [ ] 소셜 로그인 콘솔 3곳에 지금 로고가 올라가 있는지 확인(S10)
- [ ] 원본 정리: 벡터(SVG) 마스터 1개 + 풀블리드 1024 RGB + 안전영역 전경 레이어 + 단색 흰 실루엣 + 워드마크(결정에 따라) — 지금 시안은 PIL 코드(`make_e9_final.py`)로 그려 **PNG 만 있고 벡터가 없다**
- [ ] 마스크 미리보기 확인: 원형(Android·인스타 프로필)·iOS 모서리·마스커블에서 큰 잎이 잘리지 않는지

**2단계 — 코드 변경 (1~1.5일, 웹은 잠가서 머지)**
- [ ] D1: `make_store_assets.py` 입력부 재작성 + D3: 변환 스크립트 신설
- [ ] `frontend/assets/*`(C1)·웹 아이콘(W1·W2)·마스커블 분리(W4)·OG 이미지(W7)·`index.html`(W3)·`sw.js`(W5)·`download.html`(W6)
- [ ] 앱 안: `SplashScreen.tsx` radius(R2)·워드마크(R1)·죽은 import/페이지/PWA 컴포넌트 정리(R3~R5)
- [ ] 노랑·초록 색 토큰 필요 시 `index.css`(R6)
- [ ] 푸시 코드 색 통일(C2 — 영역 A)·~~메일 철자(B1)~~ ✔ 2026-11-07·~~`shared.tsx`(M1)~~ ✔ 2026-11-07
- [ ] Android 알림 실루엣(A4)·스플래시(A6)·iOS 시작 화면(I3)·`capacitor.config.ts`(I4)·위젯 미리보기 한 장(A9)

**3단계 — 네이티브 빌드 (빌드 0.5일 + 심사 대기 1~3일)**
- [ ] 아이콘 일괄 생성 후 눈으로 확인(홈 화면 격자·원형·알림)
- [ ] `cap sync` → Android `versionCode`·`versionName` 올림 → AAB 빌드 → Play 업로드(사용자)
- [ ] 맥에서 pull → `npm run build` → `cap sync ios` → 빌드번호 올림 → Xcode Archive → App Store Connect 업로드(사용자). **수동 출시로 설정**
- [ ] 알림 실기기 확인(상태바 아이콘이 흰 네모가 아닌지), 위젯 추가 화면의 앱 아이콘, 시작 화면 → 스플래시 깜빡임

**4단계 — 스토어 자산 (0.5일, 워드마크를 바꾸면 1.5일)**
- [ ] Play: 512 아이콘·피처 그래픽 업로드(S1·S2)
- [ ] (조건부) 스크린샷 소스 재촬영 → 24장 재생성 → zip 3개 → 한 장씩 업로드(S3) — **재촬영은 불필요로 판정**(7장 모두 앱 헤더를 잘라 낸 캡처라 옛 워드마크가 안 보임), 1번 장만 새 락업으로 24장 재생성·zip 3개 ✔ 2026-11-07. **업로드(사용자)만 남음**
- [ ] `ios-whatsnew`·Play 새로운 기능 문구(S4) — 문구 한 줄(`· 앱 아이콘이 새로워졌어요.`)을 `STORE_LISTING.md` 에 적어 둠 ✔, 콘솔 입력(사용자)은 미완
- [ ] 심사 통과 확인 후 iOS 수동 출시 + Android 출시(점진 출시 비율 확인)

**5단계 — 마케팅 (0.5~1일)**
- [ ] 같은 날: 웹 로고 잠금 해제(W1~W7)·인스타 프로필 사진(M3)·카카오/구글/네이버 로고(S10, 올려 둔 곳만)
- [ ] 릴스 엔딩 교체(M1) ✔ 코드·정지 프레임 확인 2026-11-07 · **미게시분 재렌더는 미완**(`my-video/out` 에 렌더본이 남은 미게시 편이 있으면 그 편만 다시 렌더) · 문서(M2·M6) ✔ · PDF(B4) 변경 불필요 확인 ✔
- [ ] 안내 컷 1장

---

## 5. 사용자가 결정해야 할 것

1. **최종안**(**결정됨: P1, 메인 아이콘은 옅은 판 — 2026-11-08**): P1(연속성↑·위계↓) / P12(위계↑·연속성↓, 노랑이 받침·잎으로) / P14(옅은 바탕 — 존재감↓). 3장 표 참고. 형태는 E9 정식, 큰 잎 한 장(E9)인지 큰 잎+작은 잎(E9g, 추천)인지.
2. **아이콘 교체 시점**: 다음 빌드(iOS 1.0.12/19·Android 1.0.15/16)에 로고 전용으로 / 더 뒤. (위 4장 근거)
3. **앱 이름·워드마크**: 영문 가는 「CookMatch」 유지 / 굵은 한글 「쿡매치」로 통일 / 한글+영문 병기. **이것이 스크린샷 재촬영 여부(35개)·이메일 철자·릴스 `Wordmark`·OG 를 정한다.** 이름 자체(「쿡매치」)를 바꾸는 것은 이번 범위에 넣지 않았다.
4. **계절 아이콘**: 1차에서는 빼는 것을 권한다. 도입하면 iOS 는 **대체 아이콘 전부가 바이너리 안에** 있어야 하고 전환 플러그인이 필요(전환 때 시스템 안내창이 뜸), Android 는 아이콘마다 `activity-alias` 를 두고 전환 시 런처가 갱신/앱 종료 가능. 단 iOS 대체 아이콘 인프라는 **제품 페이지 최적화의 아이콘 테스트와 같은 인프라**라 2차에 같이 하면 이득.
5. **앱 UI 색**: 노랑 #FFD600·잉크 #1A1A1E 유지(권장, 변경 0) / 초록을 UI 색 토큰에 추가할지.
6. **iOS 18 다크/틴트 아이콘**을 이번에 만들지(선택).
7. **스크린샷**: 지금 스토어에 올라간 게 v1 인지 v3 인지 알려 주기 → 로고 교체 때 v3 를 같이 올릴지.
8. **이메일·PDF 에 로고를 넣을지**(현재는 둘 다 로고 없음 — 넣으면 외부 호스팅 이미지와 새 PDF 틀이 필요).
9. **소셜 로그인 동의 화면에 올려 둔 로고**가 있는지(카카오·구글·네이버).
10. **상표 출원**을 진행할지, Play 에서 `com.cookmatch.app` 을 다른 개발자가 쓰고 있다는 점을 어떻게 볼지.
11. **Play 스토어 등록정보 실험**으로 아이콘 A/B 를 할지(비추천 — S6).

---

## 6. 진행 상태 — 영역 C (2026-11-07, 스토어 스크린샷·문서·릴스 엔딩·이메일)

### 완료(저장소 반영)
| 점검표 # | 한 일 |
|---|---|
| S3 | 스크린샷 v3 첫 장(`01_brand`)을 새 락업(마크 타일 + 「쿡매치 CookMatch」)으로 교체. **재촬영한 장: 없음** — 2~8번 장 캡처는 모두 상단 앱 헤더를 잘라 내(`cut`) 옛 「CookMatch」 워드마크가 안 보인다(Play 8장을 직접 열어 확인, iOS 2종은 같은 원본). 24장 + zip 3개 + 첫 장 시안(`alt/01_{A,B,C}`) 재생성. 공용 자산 `store/brand/`(`python store/make_brand_assets.py`) 신설 |
| S4·S5 | `store/STORE_LISTING.md` 에 「앱 아이콘·로고」 절 추가(옛 이름 점검·**아이콘 일치 점검 체크 항목**·A/B 실험 비추천 메모·콘솔 업로드 목록), 그래픽 표의 스크린샷 경로 v1→v3, `store/paste/ios-desc.txt`(옛 「요리 AI」 잔재) 문서와 같게 재생성. `PLAY_CONSOLE_ANSWERS.md`·`PLAY_PRODUCTION_APPLICATION.md` 에는 아이콘/브랜드 답변이 없어(테스터 피드백의 과거 사실뿐) 변경 없음 |
| D2 | `make_store_assets_v3.py` 가 옛 워드마크 PNG(`냉털이 로고 white.png`)를 더는 읽지 않음 |
| M1 | 릴스 `my-video/src/shared.tsx` `AppIcon`(새 마크 + 둥근 모서리 CSS, `variant="black"` 검정 바탕판)·`Wordmark`(새 「쿡매치 CookMatch」 PNG, `on="white|yellow|black"`)·`public/cookmatch_icon.png`·`cookmatch_mark_reverse.png`·`wordmark_on_*.png`. `remotion still` 로 엔딩(`CookMatchTeaser` 262프레임)·인트로(60프레임) 확인. **이미 올린 릴스는 불변** |
| M2 | `my-video/CLAUDE.md`·`store/REEL_FORMATS.md` 에 새 로고 규칙(엔딩 마크 크기·위치, 노랑 바탕=검정 바탕판/검정·흰 바탕=정식) 추가. `COOKING_REEL_GUIDE.md` 는 `CtaOutro` 만 가리켜 변경 없음 |
| M5 | `INSTAGRAM_AUTO_DM.md`·`RECIPE_PDF_GUIDE.md` 에 로고 메모 추가(DM 문구·카드 이미지·PDF 에는 로고가 없어 **틀 변경 없음** — `scripts/make_dm_pdf.py` 확인) |
| M6 | `AD_BRIEF.md` 6장 브랜드 자산: 옛 마스코트 「냉털이」·없는 파일 `쿡매치글씨로고.png` 안내를 새 로고(P1)·워드마크·바탕별 규칙·`store/brand/` 경로로 교체. (★ 폴더 사본은 로컬 untracked 라 같은 두 줄만 로컬에서 고침) |
| B1 | `backend/app.py` 인증 코드 메일: 철자 「Cookmatch」→「쿡매치」(제목 `[쿡매치] 이메일 인증 코드`·본문), 머리글에 노랑 #FFD600 바 + 「쿡매치 CookMatch」 글자(이미지 없음 — 마크 PNG 공개 주소가 아직 없고 메일 클라이언트가 외부 이미지를 막는 일이 많아 텍스트 헤더로 대체). 발송·배포는 안 함(서버 배포 때 반영) |
| B4 | PDF·DM: 로고 이미지가 원래 없어 **변경 불필요** |

### 미완료 / 다른 영역·사용자 몫
- 앱 안 헤더 워드마크가 보이는 **Play 피처 그래픽**의 폰 화면 2장(S2): 영역 A(아이콘 칩)·영역 B(헤더 락업) 결과 뒤 확인.
- 영역 B 의 「브랜드 적용 B — 마크·스플래시·헤더」 변경이 반영돼도 **스토어 스크린샷 재촬영은 필요 없다**(2~8번 장에 헤더가 안 나옴). 앞으로 헤더가 보이게 찍는 새 스크린샷을 만들 때만 새 헤더로 찍을 것.
- `my-video/out` 의 **미게시 렌더본**(엔딩이 옛 아이콘)은 다시 렌더해야 한다 — 올리기 전에 그 편만.

### 사용자가 저장소 밖에서 할 일 — 올릴 파일 경로(드래그용)
기준 폴더: `C:/Users/user/Desktop/RefrigeratorCode/`. 아이콘·피처 그래픽·앱 번들은 영역 A 가 새로 만든 것인지 **파일을 열어 새 마크(노랑 바탕·흰 원·검정 받침·초록 잎)인지 먼저 확인**.

| # | 어디서 | 할 일 | 올릴/확인할 파일 |
|---|---|---|---|
| 1 | **맥 / Xcode** | 맥에서 pull → `npm run build` → `npx cap sync ios` → `AppIcon` 이 새 아이콘인지 확인 → 서명·빌드 번호(iOS 1.0.11/18) → Archive → 업로드 | 확인: `frontend/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`(1024, 알파 없음) |
| 2 | **App Store Connect** | 아이콘은 빌드에서 자동. 스크린샷 v3 **한 장씩 순서대로** 업로드(6.9" 칸 + 6.5"/중형 칸). 마케팅 URL 은 인스타 `@Cook._.match` 그대로. 「이 버전의 새로운 기능」에 `· 앱 아이콘이 새로워졌어요.` 한 줄 | `store/screenshots_v3/ios/01~08_*.png`(1290×2796) · `store/screenshots_v3/ios_1206x2622/01~08_*.png`(1206×2622) · 묶음 `store/upload_packages/v3_AppStore_1290x2796_8장.zip`·`v3_AppStore_1206x2622_8장.zip` |
| 3 | **Play Console**(Android 1.0.14/15 업로드와 같은 날) | 앱 아이콘 512·피처 그래픽·휴대전화 스크린샷 교체. 「새로운 기능」에 같은 한 줄 | `store/icons/play_icon_512.png` · `store/play_feature_graphic.png`(1024×500) · `store/screenshots_v3/play/01~08_*.png` · 묶음 `store/upload_packages/v3_GooglePlay_폰_1080x1920_8장.zip` |
| 4 | **인스타 프로필 사진**(앱스토어 마케팅 URL 페이지) | 프로필 사진 교체 — 원형 크롭에서 큰 잎이 잘리지 않는지 미리보기 확인 | `store/brand/cookmatch_mark_1024.png`(또는 `cookmatch_mark_512.png`) |
| 5 | **카카오 디벨로퍼스**(앱 「Cookmatch」, ID 1359747) | 앱 아이콘 칸에 올려 둔 게 있는지 확인 → 있으면 교체, 없으면 올릴지 선택. 앱 이름 철자도 「쿡매치」 로 통일 고려(로그인 동의 화면에 보임) | `store/brand/cookmatch_mark_512.png` |
| 6 | **구글 클라우드 OAuth 동의 화면**(`CookMatch Web Client_web`, 프로덕션 게시 상태) | 로고를 **이미 올려 뒀는지부터 확인.** 안 올렸다면 **그대로 두는 것이 안전**(로고를 올리면 브랜드 확인 심사가 걸릴 수 있음 — 내 지식 기준, 콘솔 안내 확인). 올렸다면 새 마크로 교체(심사 재요청 안내가 뜨는지 확인) | `store/brand/cookmatch_mark_120.png`(120×120) |
| 7 | **네이버 개발자센터**(로그인 앱, 검수 승인 대기 기록) | 앱 로고 칸이 있으면 교체(검수 중이면 승인 뒤) | `store/brand/cookmatch_mark_512.png` |
| 8 | **KIPRIS**(kipris.or.kr) | 「쿡매치」·「CookMatch」 문자 + 새 마크 도형 선행 상표 검색(출원 전 변리사 상담 권장) | 비교용: `store/logo_proposals/e9_final/p1_final/fullset/app_icon_1024.png` |
| 9 | **스레드 프로필** | **변경 없음** — `THREADS_GUIDE.md` 규칙(사람 계정, 앱 아이콘 안 씀) 유지 | — |
| 10 | **서버 배포(Railway 복구 후)** | 인증 메일 표기·머리글 변경 반영 | `backend/app.py` |

---

## 부록 A. 옛 이름·옛 로고 잔재와, 로고와 무관하게 지금 고치면 좋은 것

| # | 발견 | 위치 | 권장 |
|---|---|---|---|
| A-1 | **iOS 시작 화면이 Capacitor 기본 그림**(브랜드 아님) | `Assets.xcassets/Splash.imageset`(3장 동일 파일) | 로고와 무관하게 교체 |
| A-2 | Android 위젯 추가 화면 미리보기 한 장이 **옛 이름**(「요리 AI」·「AI 식단」) | `res/drawable-nodpi/widget_quick_square_preview.png` | 새로 캡처 |
| A-3 | **푸시 색이 두 가지**: `push_send.py:29` `#FFD600` vs `send_expiry_push_notifications.py:81`·`colors.xml` `#E0A800`(주석: FFD600 은 밝은 알림 배경에서 안 보임) | 서버 2파일 | `#E0A800` 으로 통일 |
| A-4 | **옛 이름 「냉털이」 로고 페이지**가 라우트에 남음(링크 없음) | `FridgeSelect.tsx`+`냉털이 로고.png`+`AppRouter.tsx:222` | 삭제 |
| A-5 | 파일 이름이 **내용과 반대**: `냉털이 로고 white.png` 는 영문 CookMatch 워드마크 | `src/assets` (import 5곳: `TopNavBar`·`SplashScreen`·`MyPage`(미사용)·`IngredientDetail`(미사용)·`make_store_assets_v3.py:372`) | `cookmatch_wordmark.png` 로 이름 정리 |
| A-6 | **PWA 설치 안내 5파일은 마운트되지 않는 죽은 코드**이고 이미지 경로(`/src/assets/...`)가 빌드본에 없는 개발 경로 | `PWAInstall{Guide,Prompt,Section}.tsx`·`PWATestPage.tsx`·`utils/pwa.ts:97-98` | 삭제(함수는 `OfflineIndicator` 가 일부 씀 — 단위 확인) |
| A-7 | **매니페스트**: 1024 파일 한 개를 72~512 로 표기, `any maskable` 동시 지정, 숏컷 아이콘 3개가 **없는 파일**(`/navigator_*.png`) | `manifest.json` | 192/512 실제 파일 + 마스커블 분리 + 숏컷 정리 |
| A-8 | **서비스워커 `urlsToCache` 가 개발 경로**(`/src/assets/…`)라 빌드본에서는 `index.html` 이 대신 저장됨(Vercel rewrite) | `sw.js:8-15` | 실제 빌드 경로로 |
| A-9 | **OG 메타 전무** → 링크 공유 미리보기에 이미지가 안 나옴 | `index.html` | W7 |
| A-10 | **철자 세 갈래**: 메일 「Cookmatch」·카카오 앱 「Cookmatch」·릴스 「CookMatch」(굵게, Match 갈색)·앱 헤더 「CookMatch」(가는 회색)·한글 「쿡매치」 | `app.py:2184-2206`·카카오 콘솔·`shared.tsx:88` | 하나로 통일 |
| A-11 | **현재 아이콘 노랑이 카카오 노랑에 가깝다**: 아이콘 실제 색 (254,229,0) ≈ #FEE500(카카오), 앱 토큰은 #FFD600, 아이콘은 주황으로 번지는 그라데이션 | `icon.png` 픽셀 실측 | 새 아이콘은 평평한 #FFD600 으로(시안은 이미 그러함) |
| A-12 | Android 템플릿 잔재 3개(초록 격자·로봇·#FFFFFF) | A11 | 삭제 |
| A-13 | 미사용 이미지 자산: `냉털로고블랙/화이트/냉털이로고및캐릭터.png`·`쿡매치어플아이콘.png`(중복)·`open_loading_page{,_}.png`·`비회원으로시작하기로고.png`·`구글/카카오/네이버로그인로고.png`·`react.svg`·`public/index.html`(CRA)·`vite.svg` | `src/assets`·`public` | 보관하거나 삭제(코드에서 import 0 확인) |
| A-14 | `AD_BRIEF.md` 가 **존재하지 않는 `쿡매치글씨로고.png`** 와 마스코트 「냉털이」를 안내 | `AD_BRIEF.md:385-387` 및 ★폴더 사본 | 갱신(M6) |
| A-15 | `splash-dark.png`·Android `drawable-night/splash.png` 가 라이트와 **같은 그림**(다크 대응 없음) | C1·A6 | 다크 스플래시를 둘지 결정(스플래시 색 결정과 함께) |
| A-16 | `build.gradle` 은 1.0.13/14, 문서는 다음 Android 1.0.14/15 | A10 | 빌드 방식 확인 |
| A-17 | 앱 키워드 「냉털」·「냉털이」는 **의도적으로 남긴 검색어** | `STORE_LISTING.md` 키워드 | 유지(잔재 아님) |

## 부록 B. 앞선 문서(`README.md` 6장 등)에서 바로잡는 점
- 「앱 아이콘 원본 `frontend/assets/icon.png` 에서 글리프를 추출」 → 맞지만 **새 다색 마크에는 이 방식이 통하지 않는다**(0장 3번). 「손으로 만지는 파일 10개 안팎」 → **약 28개**.
- 「위젯 `ic_widget_*.xml`·`widget_*_bg.xml`·위젯 미리보기를 로고 때문에 확인」 → **로고가 없다**. 바꿀 것 없음(위 A8·I6). 미리보기는 별도 이유(A9)로만.
- 「앱 안 로고: `PWAInstall*.tsx`·`PWATestPage.tsx`·`FridgeSelect.tsx`·`IngredientDetail.tsx`·`MyPage.tsx` 이미지만 교체」 → PWA 5개는 **죽은 코드**, `FridgeSelect` 는 **링크 없는 옛 페이지**, `MyPage`·`IngredientDetail` 은 **import 만 있음**. 실제로 이미지가 쓰이는 앱 안 화면은 `TopNavBar`·`SplashScreen` 두 곳이다.
- 「스플래시: `@capacitor/assets` 로 재생성하는 경우 한 번에」 → 그 도구가 **설치돼 있지 않다**. 스플래시 32개는 직접 만든 변환 스크립트가 필요.
- 「`backend/push_send.py`(푸시 아이콘 참조 여부는 적용 시 확인 필요)」 → 확인함: `FCM_ICON='ic_stat_cookmatch'` 이름 참조, 색 `#FFD600`(C2).
- 「이메일 템플릿」 → 1종뿐(인증 코드). 로고는 없고 철자가 「Cookmatch」(B1).

## 부록 C. 확인하지 못한 것 (가정)
- 인스타 프로필 현재 사진·카카오/구글/네이버 콘솔에 올린 로고·상표 검색 결과: **로그인이 필요하거나 검색을 하지 않아 확인 못 함**.
- 현재 스토어에 올라간 스크린샷 버전(v1/v3), Apple/Google 현재 심사·출시 상태: 문서 기준.
- Apple/Google 정책(아이콘 파일 조건, PPO 에서 아이콘 테스트의 대체 아이콘 조건, Play 실험 가능 항목, 구글 로고 확인 심사)은 **내 지식 기준**이며 제출 전 공식 문서로 다시 확인할 것.
- 실기기 렌더링(원형 마스크의 큰 잎, 29px 알림 실루엣, 다크 배경화면)은 합성 미리보기만 있고 실기기 확인 전.
- 맥/Xcode 는 이 PC 에 없어 `project.pbxproj`·소스 파일 내용으로만 iOS 를 확인했다.
