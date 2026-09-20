import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
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
