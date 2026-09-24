import UIKit
import Capacitor
import WidgetKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        addSafeAreaCovers()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // contentInset 'always' 로 웹뷰가 상태바 아래에 그려지지만, 스크롤한 내용은 상태바 영역까지
    // 비쳐 보인다. 그 영역을 흰색으로 덮어 가린다.
    private func addSafeAreaCovers() {
        guard let window = window else { return }

        let top = UIView()
        top.backgroundColor = .white
        top.isUserInteractionEnabled = false
        top.translatesAutoresizingMaskIntoConstraints = false
        window.addSubview(top)
        NSLayoutConstraint.activate([
            top.leadingAnchor.constraint(equalTo: window.leadingAnchor),
            top.trailingAnchor.constraint(equalTo: window.trailingAnchor),
            top.topAnchor.constraint(equalTo: window.topAnchor),
            top.bottomAnchor.constraint(equalTo: window.safeAreaLayoutGuide.topAnchor),
        ])
    }

    // 앱이 화면에서 빠질 때(홈으로 나가기·앱 전환) 마이캘린더 위젯 요약본을 위젯이 읽는 곳으로 옮기고 다시 그리게 한다.
    // 안드로이드 MainActivity.onPause 와 같은 역할(2026-09-23).
    func sceneWillResignActive(_ scene: UIScene) {
        CalendarWidgetSync.sync()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// 아이폰 화면 왼쪽 끝 스와이프로 뒤로 가기 — 2026-09-22 에 웹뷰 전체 제스처(allowsBackForwardNavigationGestures)로
// 켰더니 탭 이동도 방문 기록이라 탭 화면에서도 밀면 이전 탭으로 넘어갔다(2026-09-24 지적). 웹뷰 제스처는 끄고,
// 위에 뒤로가기 버튼이 있는 화면에서만 웹 쪽(utils/edgeSwipeBack.ts)이 스와이프를 받아 그 버튼을 누른다.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = false
    }
}

/// 웹 화면(`utils/widgetSnapshot.ts`)이 Capacitor Preferences 로 남긴 마이캘린더 요약본을
/// **App Group** 저장소로 복사한다 — 위젯은 앱과 다른 프로세스라 앱 전용 UserDefaults 를 못 읽는다.
/// 요약본이 없으면(로그아웃·계정 전환 때 웹이 지운다) App Group 쪽도 지워 위젯이 빈 달력이 된다.
/// App Group(`group.com.cookmatch.app`)은 App·CookMatchWidget 두 타깃 모두에 capability 로 켜 있어야 한다
/// (store/IOS_WIDGET_SETUP.md).
enum CalendarWidgetSync {
    static let appGroup = "group.com.cookmatch.app"
    static let key = "cookmatch_calendar"
    /// Capacitor Preferences(iOS)는 UserDefaults.standard 에 "CapacitorStorage." 을 붙여 저장한다
    static let capacitorKey = "CapacitorStorage." + key

    static func sync() {
        guard let shared = UserDefaults(suiteName: appGroup) else { return }
        let value = UserDefaults.standard.string(forKey: capacitorKey)
        guard value != shared.string(forKey: key) else { return }  // 바뀐 게 없으면 위젯을 깨우지 않는다
        if let value = value { shared.set(value, forKey: key) } else { shared.removeObject(forKey: key) }
        WidgetCenter.shared.reloadTimelines(ofKind: "CookMatchCalendarWidget")
        WidgetCenter.shared.reloadTimelines(ofKind: "CookMatchCalendarLargeWidget")
    }
}
