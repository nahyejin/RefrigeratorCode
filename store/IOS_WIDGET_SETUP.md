# 아이폰 홈 화면 위젯 — 맥(Xcode)에서 붙이는 순서

코드는 윈도우에서 미리 써 뒀다(맥 Xcode 로 아직 빌드해 보지 않음 — 첫 빌드에서 오류가 나면 고친다):
- [`CookMatchWidget.swift`](../frontend/ios/App/CookMatchWidget/CookMatchWidget.swift) — 버튼 위젯 2종 + 위젯 묶음(@main)
- [`CookMatchCalendarWidget.swift`](../frontend/ios/App/CookMatchWidget/CookMatchCalendarWidget.swift) — **마이캘린더 위젯 2종**(2026-09-23 추가)
- [`CookMatchWidget.entitlements`](../frontend/ios/App/CookMatchWidget/CookMatchWidget.entitlements) — App Group
- 앱 쪽: [`SceneDelegate.swift`](../frontend/ios/App/App/SceneDelegate.swift) `CalendarWidgetSync`, [`App.entitlements`](../frontend/ios/App/App/App.entitlements) App Group

맥에서는 **Xcode 에 위젯 타깃을 만들어 이 파일들을 넣고, 두 타깃에 App Group 을 켜는 일**을 한다(30~40분).

안드로이드 위젯(2026-09-23 완성)과 같은 주소·같은 디자인을 쓴다:
`com.cookmatch.app://camera` · `://chat` · `://plan` → 웹 쪽 `NativeShortcutBridge` 가 받아
카메라 시트 / 요리 AI 대화창 / 이번 주 식단으로 보낸다.

| 위젯 목록 이름 | 크기 | 내용 | 탭 |
|---|---|---|---|
| 쿡매치 (가로) | 중간(systemMedium) | 재료 찍기 · 요리 AI · AI 식단 | 버튼마다 따로 |
| 쿡매치 (정사각형) | 작은(systemSmall) | 요리 AI 크게 + 재료 찍기 · AI 식단 | **전체가 요리 AI 하나** (iOS 제약: 작은 위젯은 탭 영역이 하나뿐) |
| 마이캘린더 | 중간(systemMedium) — 안드로이드 4×2 | 「2026년 9월」 / 달력 + 이번 달 목표·오늘 한 줄·범례 | 전체가 마이캘린더 |
| 마이캘린더 (크게) | 큰(systemLarge) — 안드로이드 4×3 | 목표·범례 / 달력 + 오늘·내일 목록 | 전체가 마이캘린더 |

**마이캘린더 위젯의 데이터 흐름** — 위젯은 앱과 다른 프로세스라 앱 저장소를 못 읽는다:
웹 화면이 마이캘린더를 열 때 요약본을 Capacitor Preferences(`CapacitorStorage.cookmatch_calendar`)에 남김 →
앱이 화면에서 빠질 때 `SceneDelegate.sceneWillResignActive` 가 App Group `group.com.cookmatch.app` 으로 복사 + 위젯 새로 그리기 →
위젯이 읽음. 로그아웃하면 웹이 요약본을 지우고, 복사 때 App Group 쪽도 지워져 빈 달력이 된다. 자정마다 스스로 다시 그린다(오늘 표시).

---

## ✅ 위젯 타깃 생성 완료 (2026-09-23, 맥에서 스크립트로)

Xcode 의 File → New → Target 대신, `xcodeproj` (Ruby gem, `gem install xcodeproj --user-install`)으로
`App.xcodeproj` 를 직접 편집해 `CookMatchWidget` 타깃을 만들고 4개 파일(스위프트 2개·Info.plist·entitlements)을
연결·Embed·서명 설정까지 마쳤다. 아래 2~4단계(Xcode 로 타깃 만들기)는 **이미 끝났으니 건너뛴다.**

- `xcodebuild ... -allowProvisioningUpdates` 로 Debug(실기기: iPhone 17 Pro)와 Release(Archive) 둘 다 빌드 성공.
  App ID(`com.cookmatch.app.CookMatchWidget`)와 App Group 등록도 **Apple 서버에 자동으로** 됐다(Devices 등록 때와 달리
  App ID·Capability 추가는 자동 프로비저닝이 처리해 준다).
- 실기기에 설치·실행까지 확인. **남은 건 아이폰에서 직접 위젯을 홈 화면에 추가해 눈으로 보는 것뿐**(5단계부터 이어서 함).

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
   - ⚠ 예제를 지울 때 Xcode 가 같은 이름의 **우리 `CookMatchWidget.swift` 원본을 덮어썼거나 지웠는지** `git status` 로 확인. 지워졌으면 `git checkout -- frontend/ios/App/CookMatchWidget` 로 되살린다.
2. Finder 에서 `frontend/ios/App/CookMatchWidget/` 의 **`CookMatchWidget.swift` 와 `CookMatchCalendarWidget.swift` 두 개**를 Xcode 의 **CookMatchWidget** 폴더로 끌어다 놓는다.
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

### App Group 켜기 (마이캘린더 위젯용 — 두 타깃 모두)

1. **App 타깃 → Signing & Capabilities → + Capability → App Groups** → `+` → **`group.com.cookmatch.app`** 입력(체크 표시 확인).
   - 레포의 `App.entitlements` 에 이미 이 값이 들어 있다. Xcode 가 같은 파일을 쓰는지(Build Settings → Code Signing Entitlements = `App/App.entitlements`) 확인.
2. **CookMatchWidget 타깃 → Signing & Capabilities → + Capability → App Groups** → 같은 **`group.com.cookmatch.app`** 체크.
   - Build Settings → Code Signing Entitlements 를 `CookMatchWidget/CookMatchWidget.entitlements`(레포 파일)로 둔다. Xcode 가 새 entitlements 파일을 만들었다면 그걸 지우고 레포 파일을 쓴다.
3. 자동 서명이면 Xcode 가 Apple 개발자 계정에 App Group 을 등록하고 두 App ID 에 붙여 준다. "Provisioning profile doesn't include the application-groups entitlement" 오류가 나면 Signing 을 한 번 껐다 켜거나 developer.apple.com → Identifiers 에서 두 App ID(`com.cookmatch.app`, `com.cookmatch.app.CookMatchWidget`)에 App Groups 를 켠다.

> ⚠ App 타깃의 entitlements 에 App Group 이 들어 있으므로, **위 1번을 하기 전에는 앱 자체 빌드도 서명 오류가 날 수 있다.** 위젯 작업을 뒤로 미룰 때도 1번은 먼저 해 둔다.

## 5. 실행해 보기

1. 위쪽 스킴을 **App** 으로 두고 ▶ 실행(시뮬레이터 또는 실기기).
2. 홈 화면으로 나가 빈 곳을 꾹 눌러 **+ → 쿡매치** 검색.
3. **가로(중간)** 위젯을 홈에 놓고 버튼 세 개를 각각 눌러 본다.
   - 재료 찍기 → 「사진으로 재료 담기」 시트
   - 요리 AI → 쿡매치 AI 대화창
   - AI 식단 → 「이번 주 식단 추천」
4. **정사각형(작은)** 위젯도 놓아 보고, 누르면 요리 AI 가 열리는지 확인.
5. **마이캘린더** 위젯(중간·큰)을 놓는다 → 처음엔 빈 달력 + 「마이캘린더를 열면 기록이 보여요」.
   앱에서 마이캘린더 탭을 연 뒤 **홈으로 나가면** 달력 점·목표 게이지·범례·오늘(내일) 목록이 채워져야 한다.
   - 확인할 것: 오늘 = 회색 둥근 네모, 계획 = 빨간 동그라미(오늘 위에도 보임), 목록 점 = 범례와 같은 꽉 찬 색 점 + 「완료」, 6주짜리 달(예: 2026년 11월·2027년 1월)에도 중간 위젯이 안 잘리는지.
   - 로그아웃 → 홈으로 나가면 빈 달력으로 바뀌는지.
   - 누르면 앱의 마이캘린더가 열리는지.

## 6. 안 될 때

| 증상 | 확인 |
|---|---|
| 위젯 목록에 쿡매치가 없다 | 앱을 한 번 실행했는지, 위젯 타깃이 App 에 **Embed** 됐는지(App 타깃 → General → Frameworks, Libraries, and Embedded Content) |
| 눌러도 앱만 열리고 화면이 안 바뀐다 | 앱이 `com.cookmatch.app` 스킴을 받는지(App 타깃 → Info → URL Types). 이미 로그인 복귀용으로 등록돼 있다. |
| 위젯이 흰 배경 없이 투명하다 | iOS 17 이상은 `containerBackground` 가 필요한데 코드에 이미 들어 있다. Xcode 가 오래된 SDK 로 빌드하는지 확인 |
| 빌드 오류 `@main` 중복 | 예제 파일(`*Bundle.swift`)을 안 지운 것 — 3-1 로 돌아가 지운다 |
| 마이캘린더 위젯이 계속 빈 달력 | ① 두 타깃 App Groups 가 **같은 이름**으로 체크됐는지 ② 앱에서 마이캘린더를 연 뒤 **홈으로 나갔는지**(나갈 때 복사된다) ③ Xcode 콘솔에서 `UserDefaults(suiteName:)` 경고가 없는지 |
| 서명 오류 `application-groups` | 위 「App Group 켜기」 3번 |

## 7. 제출

위젯이 확인되면 그대로 **1.0.2 (빌드 7)** 에 포함해 Archive → 업로드 → App Store Connect 에서 제출한다.
출시 노트 문구는 [store/STORE_LISTING.md](STORE_LISTING.md) 의 `ios-whatsnew` 를 그때 갱신해서 쓴다
(위젯, 레시피 목록 제목 고정, 스와이프 뒤로 가기, 쿠팡 배너 등 — [RELEASE_NOTES.md](../RELEASE_NOTES.md) 「다음 버전」 참고).
