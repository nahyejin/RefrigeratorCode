import WidgetKit
import SwiftUI

//  홈 화면 위젯 — 안드로이드(QuickWidgetProvider)와 같은 세 입구를 아이폰에도 둔다.
//
//  왜 이렇게 나뉘나:
//    · 작은(정사각형) 위젯은 **탭 영역을 하나만** 가질 수 있다(iOS 제약: widgetURL 하나).
//      그래서 작은 것은 가장 자주 쓰는 「요리 AI」 하나로 두고, 아이콘 셋은 장식이 아니라
//      실제로 누를 수 있는 중간 크기에서 보여 준다.
//    · 중간(가로) 위젯은 Link 를 여러 개 넣을 수 있어 세 버튼을 각각 연결한다.
//
//  누르면 앱이 `com.cookmatch.app://camera|chat|plan` 으로 열리고, 웹 쪽
//  NativeShortcutBridge 가 받아서 각각 카메라 시트·요리 AI 대화창·이번 주 식단으로 보낸다
//  (안드로이드와 같은 주소를 쓴다 — 한쪽만 바뀌는 일이 없게).
//
//  색: 흰 카드 + 옅은 회색 원 + 잉크색 아이콘. 다크 모드에서는 진회색 카드로 뒤집는다
//  (안드로이드 values-night 와 같은 값).

// MARK: - 색·문구

private enum W {
    static let card = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.114, green: 0.114, blue: 0.125, alpha: 1)   // #1D1D20
        : UIColor.white })
    static let circle = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.180, green: 0.180, blue: 0.200, alpha: 1)   // #2E2E33
        : UIColor(red: 0.945, green: 0.945, blue: 0.957, alpha: 1) }) // #F1F1F4
    static let icon = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.949, green: 0.945, blue: 0.929, alpha: 1)   // #F2F1ED
        : UIColor(red: 0.102, green: 0.102, blue: 0.118, alpha: 1) }) // #1A1A1E
    static let label = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.663, green: 0.663, blue: 0.698, alpha: 1)   // #A9A9B2
        : UIColor(red: 0.353, green: 0.353, blue: 0.388, alpha: 1) }) // #5A5A63

    static let camera = URL(string: "com.cookmatch.app://camera")!
    static let chat   = URL(string: "com.cookmatch.app://chat")!
    static let plan   = URL(string: "com.cookmatch.app://plan")!
}

// MARK: - 타임라인 (내용이 고정이라 한 칸이면 충분하다)

struct CookMatchEntry: TimelineEntry {
    let date: Date
}

struct CookMatchProvider: TimelineProvider {
    func placeholder(in context: Context) -> CookMatchEntry { CookMatchEntry(date: Date()) }

    func getSnapshot(in context: Context, completion: @escaping (CookMatchEntry) -> Void) {
        completion(CookMatchEntry(date: Date()))
    }

    /// 바뀌는 내용이 없으므로 다시 그릴 필요가 없다(.never) — 배터리를 쓰지 않는다.
    func getTimeline(in context: Context, completion: @escaping (Timeline<CookMatchEntry>) -> Void) {
        completion(Timeline(entries: [CookMatchEntry(date: Date())], policy: .never))
    }
}

// MARK: - 조각

/// 동그란 아이콘 + 아래 글자 한 줄.
private struct RoundButton: View {
    let systemName: String
    let title: String
    var diameter: CGFloat = 52

    var body: some View {
        VStack(spacing: 5) {
            ZStack {
                Circle().fill(W.circle).frame(width: diameter, height: diameter)
                Image(systemName: systemName)
                    .font(.system(size: diameter * 0.42, weight: .semibold))
                    .foregroundColor(W.icon)
            }
            Text(title)
                .font(.system(size: 12))
                .foregroundColor(W.label)
                .lineLimit(1)
        }
    }
}

/// 가로로 긴 알약 — 「요리 AI」.
private struct PillButton: View {
    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: "bubble.left.and.text.bubble.right.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(W.icon)
            Text("요리 AI")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(W.label)
        }
        .frame(maxWidth: .infinity, minHeight: 48)
        .background(Capsule().fill(W.circle))
    }
}

// MARK: - 정사각형(작은) 위젯 — 탭 하나

struct CookMatchSmallView: View {
    var body: some View {
        VStack(spacing: 14) {
            PillButton()
            HStack(spacing: 0) {
                RoundButton(systemName: "camera.fill", title: "재료 찍기")
                    .frame(maxWidth: .infinity)
                RoundButton(systemName: "calendar.badge.checkmark", title: "AI 식단")
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 12)
        // 작은 위젯은 탭 영역이 하나뿐이라 전체를 「요리 AI」로 연결한다.
        // 재료 찍기·AI 식단은 눌러도 같은 곳으로 가므로, 그 둘을 각각 쓰려면 가로 위젯을 쓴다.
        .widgetURL(W.chat)
    }
}

// MARK: - 가로(중간) 위젯 — 버튼마다 다른 곳으로

struct CookMatchMediumView: View {
    var body: some View {
        HStack(spacing: 0) {
            Link(destination: W.camera) {
                RoundButton(systemName: "camera.fill", title: "재료 찍기")
                    .frame(maxWidth: .infinity)
            }
            Link(destination: W.chat) {
                RoundButton(systemName: "bubble.left.and.text.bubble.right.fill", title: "요리 AI")
                    .frame(maxWidth: .infinity)
            }
            Link(destination: W.plan) {
                RoundButton(systemName: "calendar.badge.checkmark", title: "AI 식단")
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 14)
    }
}

// MARK: - 위젯 정의

/// iOS 17 부터는 위젯이 스스로 배경을 칠해야 한다(containerBackground). 그 아래 버전은 기존처럼 배경을 깐다.
private extension View {
    @ViewBuilder func cookMatchBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(W.card, for: .widget)
        } else {
            ZStack { W.card; self }
        }
    }
}

struct CookMatchQuickWidget: Widget {
    let kind = "CookMatchQuickWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CookMatchProvider()) { _ in
            CookMatchMediumView().cookMatchBackground()
        }
        .configurationDisplayName("쿡매치 (가로)")
        .description("재료 찍기·요리 AI·AI 식단 바로 열기")
        .supportedFamilies([.systemMedium])
    }
}

struct CookMatchSmallWidget: Widget {
    let kind = "CookMatchSmallWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CookMatchProvider()) { _ in
            CookMatchSmallView().cookMatchBackground()
        }
        .configurationDisplayName("쿡매치 (정사각형)")
        .description("누르면 요리 AI 가 바로 열려요")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct CookMatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        CookMatchQuickWidget()
        CookMatchSmallWidget()
        CookMatchCalendarWidget()       // CookMatchCalendarWidget.swift — 마이캘린더(중간)
        CookMatchCalendarLargeWidget()  // 마이캘린더(크게)
    }
}
