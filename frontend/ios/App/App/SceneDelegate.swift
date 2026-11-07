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

        if let window = window { SafeAreaCovers.shared.install(in: window) }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
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
        // 웹(utils/barTint.ts)이 스플래시 동안 상태바·홈 인디케이터 영역을 노랑으로 바꾸는 데 쓰는 작은 플러그인
        bridge?.registerPluginInstance(BarTintPlugin())
    }
}

/// 상태바(위)·홈 인디케이터(아래) 영역을 덮는 뷰 두 장 — contentInset 'always' 로 웹뷰가 이 영역을 피해 그려지므로
/// (capacitor.config.ts) 그 자리는 웹이 못 칠하고 네이티브 뷰만 칠할 수 있다.
///  - 위: 평소 흰색. contentInset 'always' 로 웹뷰가 상태바 아래에 그려지지만 스크롤한 내용은 상태바 영역까지
///    비쳐 보여서 흰색으로 덮는다(2026-09-20).
///  - 아래: 평소 투명(하단은 웹 하단 탭이 그 영역까지 쓴다).
/// 스플래시(웹 SplashScreen) 동안에는 둘 다 노랑 #FFD600 — 스플래시가 상태바 영역까지 노랗게 보이도록(2026-11-08 「맨 위가 하얀색」).
/// 앱이 뜨는 순간부터 노랑으로 시작해(네이티브 정지 스플래시 → 웹 스플래시 사이에 흰 띠가 끼지 않게), 웹이 `BarTint.setSplash`
/// 로 끝났다고 알려 주면 흰색/투명으로 돌아간다. 웹이 10초 안에 한 번도 부르지 않으면(웹 로드 실패 등) 스스로 되돌린다.
final class SafeAreaCovers {
    static let shared = SafeAreaCovers()
    private static let splashYellow = UIColor(red: 1.0, green: 214.0 / 255.0, blue: 0.0, alpha: 1.0)  // #FFD600

    private weak var top: UIView?
    private weak var bottom: UIView?
    private var webHasReported = false

    func install(in window: UIWindow) {
        let top = makeCover()
        let bottom = makeCover()
        window.addSubview(top)
        window.addSubview(bottom)
        NSLayoutConstraint.activate([
            top.leadingAnchor.constraint(equalTo: window.leadingAnchor),
            top.trailingAnchor.constraint(equalTo: window.trailingAnchor),
            top.topAnchor.constraint(equalTo: window.topAnchor),
            top.bottomAnchor.constraint(equalTo: window.safeAreaLayoutGuide.topAnchor),
            bottom.leadingAnchor.constraint(equalTo: window.leadingAnchor),
            bottom.trailingAnchor.constraint(equalTo: window.trailingAnchor),
            bottom.topAnchor.constraint(equalTo: window.safeAreaLayoutGuide.bottomAnchor),
            bottom.bottomAnchor.constraint(equalTo: window.bottomAnchor),
        ])
        self.top = top
        self.bottom = bottom
        apply(splash: true)

        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self = self, !self.webHasReported else { return }
            self.apply(splash: false)
        }
    }

    func setSplash(_ active: Bool) {
        webHasReported = true
        apply(splash: active)
    }

    private func makeCover() -> UIView {
        let view = UIView()
        view.isUserInteractionEnabled = false
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }

    private func apply(splash: Bool) {
        top?.backgroundColor = splash ? SafeAreaCovers.splashYellow : .white
        bottom?.backgroundColor = splash ? SafeAreaCovers.splashYellow : .clear
    }
}

/// 웹에서 `registerPlugin('BarTint').setSplash({ active })` 로 부르는 앱 안 작은 플러그인(utils/barTint.ts).
/// MainViewController.capacitorDidLoad 에서 등록한다 — 새 파일·프로젝트 설정 변경 없이 이 파일 안에서 끝난다.
@objc(BarTintPlugin)
public class BarTintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarTintPlugin"
    public let jsName = "BarTint"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSplash", returnType: CAPPluginReturnPromise)
    ]

    @objc func setSplash(_ call: CAPPluginCall) {
        let active = call.getBool("active", false)
        DispatchQueue.main.async {
            SafeAreaCovers.shared.setSplash(active)
        }
        call.resolve()
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
