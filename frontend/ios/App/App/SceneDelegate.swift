import UIKit
import Capacitor

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

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// 아이폰에서 화면 왼쪽 끝을 오른쪽으로 쓸면 뒤로 가게 한다(2026-09-22).
// WKWebView 는 이 제스처가 기본으로 꺼져 있어, 뒤로 가려면 화면 속 뒤로가기 버튼을 눌러야만 했다.
// 켜면 웹 앱의 방문 기록(react-router 의 history)을 따라 한 단계 뒤로 간다 — 안드로이드는 시스템 뒤로
// 가기 제스처가 이미 같은 일을 한다(Capacitor 기본 동작: backButton 리스너가 없으면 webView.goBack()).
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }
}
