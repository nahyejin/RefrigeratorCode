# 아이폰 홈 화면 위젯 — 맥(Xcode)에서 붙이는 순서

코드는 윈도우에서 미리 써 뒀다: [`frontend/ios/App/CookMatchWidget/CookMatchWidget.swift`](../frontend/ios/App/CookMatchWidget/CookMatchWidget.swift).
맥에서는 **Xcode 에 위젯 타깃을 만들어 이 파일을 넣는 일**만 하면 된다(20~30분).

안드로이드 위젯(2026-09-23 완성)과 같은 주소·같은 디자인을 쓴다:
`com.cookmatch.app://camera` · `://chat` · `://plan` → 웹 쪽 `NativeShortcutBridge` 가 받아
카메라 시트 / 요리 AI 대화창 / 이번 주 식단으로 보낸다.

| 크기 | 내용 | 탭 |
|---|---|---|
| **가로(중간, systemMedium)** | 재료 찍기 · 요리 AI · AI 식단 | 버튼마다 따로 |
| **정사각형(작은, systemSmall)** | 같은 세 가지 모양 | **전체가 요리 AI 하나** (iOS 제약: 작은 위젯은 탭 영역이 하나뿐) |

---

## 1. 최신 코드 받기 (맥 터미널)

```bash
cd ~/Developer/RefrigeratorCode && git checkout -- frontend/ios && git pull
cd frontend && npm install && npm run build && npx cap sync ios
open ios/App/App.xcodeproj
```

## 2. 위젯 타깃 만들기 (Xcode)

1. 메뉴 **File → New → Target…**
2. **iOS → Widget Extension** 선택 → Next
3. Product Name: **`CookMatchWidget`**
   - **Include Live Activity 체크 해제**, **Include Configuration App Intent 체크 해제** (정적 위젯이라 필요 없다)
   - Team: 메인 앱과 같은 팀(HYEJIN NA), Embed in Application: **App**
4. Finish → "Activate scheme?" 이 뜨면 **Cancel**(앱 스킴 그대로 둔다).
5. Xcode 가 `CookMatchWidget` 폴더에 예제 파일들(`CookMatchWidget.swift`, `Info.plist`, 에셋 등)을 만든다.

## 3. 우리 코드로 바꾸기

1. Xcode 왼쪽 목록에서 **CookMatchWidget** 폴더 안의 예제 `.swift` 파일들(`CookMatchWidget.swift`, `AppIntent.swift`, `*Bundle.swift`, `*LiveActivity.swift` 등)을 **모두 삭제**(Move to Trash).
2. Finder 에서 `frontend/ios/App/CookMatchWidget/CookMatchWidget.swift` 를 Xcode 의 **CookMatchWidget** 폴더로 끌어다 놓는다.
   - "Copy items if needed" **체크 해제**(원본을 그대로 쓴다 → git 에 남는다)
   - Target: **CookMatchWidget 만 체크**(App 은 체크 안 함)
3. `Info.plist` 는 **Xcode 가 만든 것을 그대로 둔다.** 레포의 `frontend/ios/App/CookMatchWidget/Info.plist` 는 참고용이니, 다르면 지워도 된다.

## 4. 타깃 설정 맞추기

**CookMatchWidget 타깃 → General / Build Settings**

| 항목 | 값 |
|---|---|
| Bundle Identifier | `com.cookmatch.app.CookMatchWidget` (메인 앱 뒤에 `.CookMatchWidget`) |
| Version (MARKETING_VERSION) | 메인 앱과 **같게** — 1.0.2 |
| Build (CURRENT_PROJECT_VERSION) | 메인 앱과 **같게** — 7 |
| Minimum Deployments | iOS 15.0 이상(메인 앱과 같게) |
| Signing | Automatically manage signing, Team = HYEJIN NA |

> 버전이 메인 앱과 다르면 업로드할 때 "번들 버전 불일치"로 거절된다.

## 5. 실행해 보기

1. 위쪽 스킴을 **App** 으로 두고 ▶ 실행(시뮬레이터 또는 실기기).
2. 홈 화면으로 나가 빈 곳을 꾹 눌러 **+ → 쿡매치** 검색.
3. **가로(중간)** 위젯을 홈에 놓고 버튼 세 개를 각각 눌러 본다.
   - 재료 찍기 → 「사진으로 재료 담기」 시트
   - 요리 AI → 쿡매치 AI 대화창
   - AI 식단 → 「이번 주 식단 추천」
4. **정사각형(작은)** 위젯도 놓아 보고, 누르면 요리 AI 가 열리는지 확인.

## 6. 안 될 때

| 증상 | 확인 |
|---|---|
| 위젯 목록에 쿡매치가 없다 | 앱을 한 번 실행했는지, 위젯 타깃이 App 에 **Embed** 됐는지(App 타깃 → General → Frameworks, Libraries, and Embedded Content) |
| 눌러도 앱만 열리고 화면이 안 바뀐다 | 앱이 `com.cookmatch.app` 스킴을 받는지(App 타깃 → Info → URL Types). 이미 로그인 복귀용으로 등록돼 있다. |
| 위젯이 흰 배경 없이 투명하다 | iOS 17 이상은 `containerBackground` 가 필요한데 코드에 이미 들어 있다. Xcode 가 오래된 SDK 로 빌드하는지 확인 |
| 빌드 오류 `@main` 중복 | 예제 파일(`*Bundle.swift`)을 안 지운 것 — 3-1 로 돌아가 지운다 |

## 7. 제출

위젯이 확인되면 그대로 **1.0.2 (빌드 7)** 에 포함해 Archive → 업로드 → App Store Connect 에서 제출한다.
출시 노트 문구는 [store/STORE_LISTING.md](STORE_LISTING.md) 의 `ios-whatsnew` 를 그때 갱신해서 쓴다
(위젯, 레시피 목록 제목 고정, 스와이프 뒤로 가기, 쿠팡 배너 등 — [RELEASE_NOTES.md](../RELEASE_NOTES.md) 「다음 버전」 참고).
