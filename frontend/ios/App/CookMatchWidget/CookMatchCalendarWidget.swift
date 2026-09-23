import WidgetKit
import SwiftUI
import UIKit

//  홈 화면 **마이캘린더 위젯** — 안드로이드(CalendarWidgetProvider)와 같은 그림을 아이폰에 둔다. 보기 전용.
//
//    중간(systemMedium) = 안드로이드 4×2   「2026년 9월」 / 왼쪽 달력 + 오른쪽 목표·오늘 한 줄·범례
//    큰(systemLarge)    = 안드로이드 4×3   「2026년 9월」 / 목표·범례 / 달력 + 「오늘」·「내일」 목록
//
//  표식은 앱 마이캘린더와 같다: 완료 = 그 사람 색 점(3개까지), 계획 = 빨간 손글씨 동그라미,
//  오늘 = 옅은 회색 둥근 네모, 목록 = 범례와 같은 꽉 찬 사람 색 점 + 이미 한 것은 「완료」.
//  범례는 요약본 순서 그대로(이번 달 많이 한 순, 같으면 나 먼저 — 앱 `orderForLegend`), 두 줄까지, 넘치면 「외 N명」.
//  누르면 `com.cookmatch.app://calendar` → 웹 NativeShortcutBridge 가 마이캘린더로 보낸다.
//
//  데이터: 앱 웹 화면이 남긴 요약본(`utils/widgetSnapshot.ts`, Capacitor Preferences 키 `cookmatch_calendar`)을
//  앱이 화면에서 빠질 때 SceneDelegate 가 **App Group**(`group.com.cookmatch.app`) 저장소로 옮겨 둔다 — 위젯은
//  앱과 다른 프로세스라 앱 전용 저장소를 못 읽는다. 로그아웃하면 요약본이 지워져 빈 달력이 된다.

let cookMatchAppGroup = "group.com.cookmatch.app"
let calendarSnapshotKey = "cookmatch_calendar"

// MARK: - 색 (안드로이드 values / values-night 와 같은 값)

private enum C {
    static func dyn(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
    static let card = dyn(0xFFFFFF, 0x1D1D20)
    static let ink = dyn(0x1A1A1E, 0xF2F1ED)
    static let label = dyn(0x5A5A63, 0xA9A9B2)
    static let track = dyn(0xE6E6EA, 0x34343A)
    static let today = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(white: 1, alpha: 0.18) : UIColor(red: 0.102, green: 0.102, blue: 0.118, alpha: 0.09) })
    static let planRed = Color(UIColor(hex: 0xE5383B))
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
    /// "#3B82F6" → 색. 못 읽으면 회색.
    convenience init(css: String) {
        let s = css.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "#", with: "")
        if s.count == 6, let v = UInt32(s, radix: 16) { self.init(hex: v) } else { self.init(white: 0.55, alpha: 1) }
    }
}

// MARK: - 요약본

struct CalendarSnapshot {
    struct Member { let name: String; let color: Color; let count: Int }
    struct Item { let when: String; let title: String; let done: Bool; let color: Color }

    var days: [String: (dots: [Color], planned: Bool)] = [:]
    var goal: Int?
    var done = 0
    var goalSavings: Int?
    var members: [Member] = []
    var upcoming: [Item] = []

    /// App Group 에서 읽는다. 없거나 지난달 것이면 nil(빈 달력).
    static func load(now: Date = Date()) -> CalendarSnapshot? {
        guard let raw = UserDefaults(suiteName: cookMatchAppGroup)?.string(forKey: calendarSnapshotKey),
              let data = raw.data(using: .utf8),
              let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
        let ym = DateFormatter.cm("yyyy-MM").string(from: now)
        guard (obj["month"] as? String) == ym else { return nil }

        var s = CalendarSnapshot()
        for (key, value) in (obj["days"] as? [String: Any]) ?? [:] {
            guard let d = value as? [String: Any] else { continue }
            // 같은 사람이 하루 두 번 해도 점은 하나(앱과 같게 — 점은 요리 수가 아니라 요리한 사람)
            var seen: [String] = []
            for c in (d["dots"] as? [String]) ?? [] where !seen.contains(c) { seen.append(c) }
            s.days[key] = (seen.map { Color(UIColor(css: $0)) }, (d["planned"] as? Bool) ?? false)
        }
        s.goal = obj["goal"] as? Int
        s.done = (obj["done"] as? Int) ?? 0
        s.goalSavings = obj["goalSavings"] as? Int
        s.members = ((obj["members"] as? [[String: Any]]) ?? []).map {
            Member(name: ($0["name"] as? String) ?? "식구", color: Color(UIColor(css: ($0["color"] as? String) ?? "")),
                   count: ($0["count"] as? Int) ?? 0)
        }
        s.upcoming = ((obj["upcoming"] as? [[String: Any]]) ?? []).map {
            Item(when: ($0["when"] as? String) ?? "", title: ($0["title"] as? String) ?? "",
                 done: ($0["kind"] as? String) == "done", color: Color(UIColor(css: ($0["color"] as? String) ?? "")))
        }
        return s
    }
}

private extension DateFormatter {
    static func cm(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = format
        return f
    }
}

// MARK: - 타임라인 — 자정마다(오늘 표시·「오늘」「내일」이 바뀐다) 다시 그린다

struct CalendarEntry: TimelineEntry {
    let date: Date
    let snapshot: CalendarSnapshot?
}

struct CalendarProvider: TimelineProvider {
    func placeholder(in context: Context) -> CalendarEntry { CalendarEntry(date: Date(), snapshot: nil) }

    func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> Void) {
        completion(CalendarEntry(date: Date(), snapshot: CalendarSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> Void) {
        let now = Date()
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400))
        completion(Timeline(entries: [CalendarEntry(date: now, snapshot: CalendarSnapshot.load(now: now))],
                            policy: .after(midnight)))
    }
}

// MARK: - 조각

/// 앱 HandCircle 의 첫 획 — 안드로이드 widget_plan_circle.xml 과 같은 경로(32×28 기준)를 칸 크기에 맞춰 늘린다.
private struct HandCircle: Shape {
    func path(in r: CGRect) -> Path {
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + x / 32 * r.width, y: r.minY + y / 28 * r.height) }
        var path = Path()
        path.move(to: p(6, 15))
        path.addCurve(to: p(21, 4), control1: p(5, 7), control2: p(14, 3))
        path.addCurve(to: p(27, 19), control1: p(28, 5), control2: p(30, 12))
        path.addCurve(to: p(8, 21), control1: p(24, 25), control2: p(13, 26))
        path.addCurve(to: p(13, 6), control1: p(4, 17), control2: p(6, 9))
        return path
    }
}

private struct Subtitle: View {
    let text: String
    var body: some View {
        Text(text).font(.system(size: 11, weight: .medium)).foregroundColor(C.label).lineLimit(1)
    }
}

/// 이번 달 달력 — 주 줄이 남는 높이를 나눠 갖는다(5주짜리 달은 5줄).
/// 숫자 칸 크기는 줄 높이에 맞춰 줄인다(최대 maxBox) — 중간 위젯은 높이가 약 155pt 라 6주짜리 달이면 빠듯하다.
private struct MonthGrid: View {
    let now: Date
    let snapshot: CalendarSnapshot?
    let maxBox: CGFloat
    let fontSize: CGFloat
    let dot: CGFloat

    var body: some View {
        let cal = Calendar(identifier: .gregorian)
        let comps = cal.dateComponents([.year, .month, .day], from: now)
        let first = cal.date(from: DateComponents(year: comps.year, month: comps.month, day: 1))!
        let lead = cal.component(.weekday, from: first) - 1
        let last = cal.range(of: .day, in: .month, for: now)!.count
        let weeks = (lead + last + 6) / 7
        let prefix = String(format: "%04d-%02d-", comps.year!, comps.month!)

        let weekdayH: CGFloat = 13
        GeometryReader { g in
            let rowH = (g.size.height - weekdayH) / CGFloat(weeks)
            let box = max(10, min(maxBox, rowH - dot - 1, g.size.width / 7 - 7))
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    ForEach(Array("일월화수목금토"), id: \.self) { w in
                        Text(String(w)).font(.system(size: 9)).foregroundColor(C.label).frame(maxWidth: .infinity)
                    }
                }
                .frame(height: weekdayH, alignment: .top)
                ForEach(0..<weeks, id: \.self) { w in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { d in
                            let day = w * 7 + d - lead + 1
                            dayCell(day: day, inMonth: day >= 1 && day <= last, isToday: day == comps.day,
                                    info: snapshot?.days[prefix + String(format: "%02d", day)], box: box)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .frame(height: rowH)
                }
            }
        }
    }

    @ViewBuilder
    private func dayCell(day: Int, inMonth: Bool, isToday: Bool, info: (dots: [Color], planned: Bool)?, box: CGFloat) -> some View {
        if inMonth {
            VStack(spacing: 1) {
                ZStack {
                    if isToday {
                        RoundedRectangle(cornerRadius: box * 0.28).fill(C.today).frame(width: box, height: box)
                    }
                    Text("\(day)").font(.system(size: fontSize)).foregroundColor(C.ink)
                    if info?.planned == true {
                        // 두 자리 숫자를 감싸도록 가로로 넉넉하게, 오늘 칠 위에 그린다
                        HandCircle().stroke(C.planRed, style: StrokeStyle(lineWidth: 1.3, lineCap: .round))
                            .frame(width: box + 7, height: box)
                    }
                }
                .frame(height: box)
                HStack(spacing: 2) {
                    ForEach(Array((info?.dots ?? []).prefix(3).enumerated()), id: \.offset) { _, c in
                        Circle().fill(c).frame(width: dot, height: dot)
                    }
                }
                .frame(height: dot)
            }
        } else {
            Color.clear
        }
    }
}

/// 목표 게이지 — 식구별 색으로 나눠 앞에서부터 칠한다(범례와 같은 순서).
private struct Gauge: View {
    let snapshot: CalendarSnapshot?
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(C.track)
                if let s = snapshot, let goal = s.goal, goal > 0 {
                    HStack(spacing: 0) {
                        ForEach(Array(s.members.enumerated()), id: \.offset) { _, m in
                            m.color.frame(width: g.size.width * CGFloat(m.count) / CGFloat(goal))
                        }
                    }
                    .frame(width: g.size.width, alignment: .leading)
                    .clipShape(Capsule())
                }
            }
        }
        .frame(height: 7)
    }
}

/// 목표 줄 + 게이지 + 절약액
private struct GoalBlock: View {
    let snapshot: CalendarSnapshot?
    let compact: Bool

    var body: some View {
        let s = snapshot
        let pct = (s?.goal ?? 0) > 0 ? min(100, Int((Double(s!.done) * 100 / Double(s!.goal!)).rounded())) : 0
        let progress: String = {
            guard let s = s, let goal = s.goal else { return "\(s?.done ?? 0)회 완료" }
            return compact ? "\(s.done) / \(goal)회 (\(pct)%)" : "\(s.done)회 / \(goal)회 달성 (\(pct)%)"
        }()
        let savings: String = {
            guard let s = s else { return "마이캘린더를 열면 기록이 보여요" }
            if s.goal != nil, let v = s.goalSavings, v > 0 {
                let f = NumberFormatter(); f.numberStyle = .decimal
                return "목표를 다 채우면 약 \(f.string(from: NSNumber(value: v)) ?? "\(v)")원"
            }
            return "앱에서 목표를 정하면 절약액을 계산해요"
        }()
        VStack(alignment: .leading, spacing: compact ? 5 : 6) {
            HStack {
                Subtitle(text: "이번 달 목표")
                Spacer(minLength: 4)
                Text(progress).font(.system(size: 11, weight: .medium)).foregroundColor(C.ink).lineLimit(1)
            }
            Gauge(snapshot: s)
            Text(savings).font(.system(size: 10)).foregroundColor(C.label).lineLimit(1).minimumScaleFactor(0.85)
        }
    }
}

/// 범례 — 폭에 맞춰 두 줄까지, 넘치면 앞에서 들어가는 만큼 + 「외 N명」, 끝에 「계획」.
private struct Legend: View {
    let snapshot: CalendarSnapshot?
    let width: CGFloat
    private let fontSize: CGFloat = 10.5
    private var font: UIFont { UIFont.systemFont(ofSize: fontSize) }
    private let gap: CGFloat = 9, mark: CGFloat = 7, markGap: CGFloat = 4, maxLines = 2

    private enum Piece: Hashable { case person(Int), more(Int), plan }

    var body: some View {
        let members = snapshot?.members ?? []
        let rows = layout(members)
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: gap) {
                    ForEach(row, id: \.self) { piece in item(piece, members) }
                }
            }
        }
    }

    @ViewBuilder
    private func item(_ piece: Piece, _ members: [CalendarSnapshot.Member]) -> some View {
        switch piece {
        case .person(let i):
            HStack(spacing: markGap) {
                Circle().fill(members[i].color).frame(width: mark, height: mark)
                Text("\(members[i].name) \(members[i].count)").font(.system(size: fontSize)).foregroundColor(C.label).lineLimit(1)
            }
        case .more(let n):
            Text("외 \(n)명").font(.system(size: fontSize)).foregroundColor(C.label).lineLimit(1)
        case .plan:
            HStack(spacing: markGap) {
                HandCircle().stroke(C.planRed, style: StrokeStyle(lineWidth: 1.1, lineCap: .round))
                    .frame(width: mark + 3, height: mark + 1)
                Text("계획").font(.system(size: fontSize)).foregroundColor(C.label)
            }
        }
    }

    private func textWidth(_ s: String) -> CGFloat {
        ceil((s as NSString).size(withAttributes: [.font: font]).width)
    }

    private func pieces(_ members: [CalendarSnapshot.Member], shown: Int) -> [(Piece, CGFloat)] {
        var out: [(Piece, CGFloat)] = (0..<shown).map { i in
            (Piece.person(i), mark + markGap + textWidth("\(members[i].name) \(members[i].count)"))
        }
        if shown < members.count { out.append((Piece.more(members.count - shown), textWidth("외 \(members.count - shown)명"))) }
        out.append((Piece.plan, mark + 3 + markGap + textWidth("계획")))
        return out
    }

    private func wrap(_ items: [(Piece, CGFloat)]) -> [[Piece]] {
        var rows: [[Piece]] = [[]]
        var x: CGFloat = 0
        for (p, w) in items {
            if x > 0 && x + w > width { rows.append([]); x = 0 }
            rows[rows.count - 1].append(p)
            x += w + gap
        }
        return rows
    }

    private func layout(_ members: [CalendarSnapshot.Member]) -> [[Piece]] {
        var shown = members.count
        while shown > 0 && wrap(pieces(members, shown: shown)).count > maxLines { shown -= 1 }
        return wrap(pieces(members, shown: shown))
    }
}

/// 목록 한 줄 — 범례와 같은 꽉 찬 사람 색 점, 이미 한 요리는 끝에 「완료」.
private struct ItemRow: View {
    let item: CalendarSnapshot.Item
    let lines: Int
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Circle().fill(item.color).frame(width: 7, height: 7).alignmentGuide(.firstTextBaseline) { $0[.bottom] }
            Text(item.title).font(.system(size: 11)).foregroundColor(C.ink).lineLimit(lines)
                .frame(maxWidth: .infinity, alignment: .leading)
            if item.done {
                Text("완료").font(.system(size: 10)).foregroundColor(C.label)
            }
        }
    }
}

private struct DayList: View {
    let title: String
    let items: [CalendarSnapshot.Item]
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Subtitle(text: title)
            if items.isEmpty {
                Text("계획 없음").font(.system(size: 11)).foregroundColor(C.label)
            } else {
                ForEach(Array(items.prefix(3).enumerated()), id: \.offset) { _, it in ItemRow(item: it, lines: 2) }
            }
        }
    }
}

private func monthTitle(_ d: Date) -> String { DateFormatter.cm("yyyy년 M월").string(from: d) }

// MARK: - 중간(가로) = 안드로이드 4×2

struct CalendarMediumView: View {
    let entry: CalendarEntry
    var body: some View {
        let s = entry.snapshot
        let today = (s?.upcoming ?? []).filter { $0.when == "today" }
        VStack(alignment: .leading, spacing: 6) {
            Text(monthTitle(entry.date)).font(.system(size: 14, weight: .bold)).foregroundColor(C.ink)
            HStack(alignment: .top, spacing: 14) {
                MonthGrid(now: entry.date, snapshot: s, maxBox: 15, fontSize: 9, dot: 3)
                GeometryReader { g in
                    VStack(alignment: .leading, spacing: 0) {
                        GoalBlock(snapshot: s, compact: true)
                        HStack(spacing: 6) {
                            Subtitle(text: "오늘")
                            if today.count > 1 {
                                Text("외 \(today.count - 1)개").font(.system(size: 10)).foregroundColor(C.label)
                            }
                        }
                        .padding(.top, 7)
                        Group {
                            if let first = today.first { ItemRow(item: first, lines: 1) }
                            else { Text("계획 없음").font(.system(size: 11)).foregroundColor(C.label) }
                        }
                        .padding(.top, 4)
                        Spacer(minLength: 4)
                        Legend(snapshot: s, width: g.size.width)
                    }
                }
            }
        }
        .padding(.horizontal, 2)
        .widgetURL(URL(string: "com.cookmatch.app://calendar"))
    }
}

// MARK: - 큰 = 안드로이드 4×3

struct CalendarLargeView: View {
    let entry: CalendarEntry
    var body: some View {
        let s = entry.snapshot
        let up = s?.upcoming ?? []
        GeometryReader { g in
            VStack(alignment: .leading, spacing: 0) {
                Text(monthTitle(entry.date)).font(.system(size: 15, weight: .bold)).foregroundColor(C.ink)
                GoalBlock(snapshot: s, compact: false).padding(.top, 10)
                Legend(snapshot: s, width: g.size.width).padding(.top, 8)
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 5) {
                        Subtitle(text: "이번 달 캘린더")
                        MonthGrid(now: entry.date, snapshot: s, maxBox: 22, fontSize: 10, dot: 4)
                    }
                    .frame(width: (g.size.width - 14) * 0.56)
                    VStack(alignment: .leading, spacing: 12) {
                        DayList(title: "오늘", items: up.filter { $0.when == "today" })
                        DayList(title: "내일", items: up.filter { $0.when == "tomorrow" })
                        Spacer(minLength: 0)
                    }
                }
                .padding(.top, 14)
            }
        }
        .padding(.horizontal, 2)
        .widgetURL(URL(string: "com.cookmatch.app://calendar"))
    }
}

// MARK: - 위젯 정의

private extension View {
    /// iOS 17 부터는 위젯이 스스로 배경을 칠해야 한다(containerBackground). 그 아래는 배경을 깐다.
    @ViewBuilder func calendarBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(C.card, for: .widget)
        } else {
            ZStack { C.card; self.padding(14) }
        }
    }
}

struct CookMatchCalendarWidget: Widget {
    let kind = "CookMatchCalendarWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CalendarProvider()) { entry in
            CalendarMediumView(entry: entry).calendarBackground()
        }
        .configurationDisplayName("마이캘린더")
        .description("이번 달 달력·목표·오늘 요리")
        .supportedFamilies([.systemMedium])
    }
}

struct CookMatchCalendarLargeWidget: Widget {
    let kind = "CookMatchCalendarLargeWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CalendarProvider()) { entry in
            CalendarLargeView(entry: entry).calendarBackground()
        }
        .configurationDisplayName("마이캘린더 (크게)")
        .description("이번 달 달력·목표·오늘 내일 요리")
        .supportedFamilies([.systemLarge])
    }
}
