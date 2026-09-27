import UIKit
import WebKit
import AVFoundation
import Capacitor

/// Aurora's native pieces on iOS, the counterparts of the Java plugins in
/// android/app/src/main/java/com/devopsmonk/aurora. Lock-screen and Control
/// Center controls come from WebKit's own Media Session support, which the
/// audio engine already feeds, so there's no playback plugin here.
class AuroraViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        // Keep playing with the screen locked or another app in front
        // (UIBackgroundModes: audio in Info.plist).
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        bridge?.registerPluginInstance(BotGuardPlugin())
        bridge?.registerPluginInstance(SignInPlugin())
    }
}

/// A hidden WKWebView at https://www.youtube.com/ for BotGuard PO tokens (see
/// src/mobile/potoken.ts). callAsyncJavaScript awaits promises, so results come
/// back directly, as JSON.
@objc(BotGuardPlugin)
public class BotGuardPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate {
    public let identifier = "BotGuardPlugin"
    public let jsName = "BotGuard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "evaluate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
    ]

    private var web: WKWebView?
    private var pendingLoad: CAPPluginCall?

    @objc func load(_ call: CAPPluginCall) {
        guard let html = call.getString("html") else {
            call.reject("html is required")
            return
        }
        let baseUrl = URL(string: call.getString("baseUrl") ?? "https://www.youtube.com/")
        DispatchQueue.main.async {
            self.destroyWeb()
            let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: WKWebViewConfiguration())
            // In the view hierarchy but invisible: an unattached WKWebView gets its timers throttled.
            web.alpha = 0.01
            web.isUserInteractionEnabled = false
            web.navigationDelegate = self
            self.bridge?.viewController?.view.addSubview(web)
            self.web = web
            self.pendingLoad = call
            web.loadHTMLString(html, baseURL: baseUrl)
        }
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pendingLoad?.resolve()
        pendingLoad = nil
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        pendingLoad?.reject(error.localizedDescription)
        pendingLoad = nil
    }

    @objc func evaluate(_ call: CAPPluginCall) {
        guard let script = call.getString("script") else {
            call.reject("script is required")
            return
        }
        DispatchQueue.main.async {
            guard let web = self.web else {
                call.reject("BotGuard page not loaded")
                return
            }
            let body = "const v = await (\(script)); return JSON.stringify(v === undefined ? null : v);"
            web.callAsyncJavaScript(body, arguments: [:], in: nil, in: .page) { result in
                switch result {
                case .success(let value):
                    call.resolve(["json": (value as? String) ?? "null"])
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.destroyWeb()
            call.resolve()
        }
    }

    private func destroyWeb() {
        web?.removeFromSuperview()
        web = nil
    }
}

/// Google sign-in for YouTube Music: Google's real page in a WKWebView (so
/// 2-step verification works). Once it lands on music.youtube.com with a
/// SAPISID cookie, that cookie jar is the session, returned as a Cookie header.
@objc(SignInPlugin)
public class SignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SignInPlugin"
    public let jsName = "SignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let screen = SignInViewController { cookie in
                call.resolve(["cookie": cookie ?? NSNull()])
            }
            let nav = UINavigationController(rootViewController: screen)
            nav.modalPresentationStyle = .fullScreen
            self.bridge?.viewController?.present(nav, animated: true)
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        let store = WKWebsiteDataStore.default()
        store.fetchDataRecords(ofTypes: [WKWebsiteDataTypeCookies]) { records in
            let google = records.filter { $0.displayName.contains("google") || $0.displayName.contains("youtube") }
            store.removeData(ofTypes: [WKWebsiteDataTypeCookies], for: google) {
                call.resolve()
            }
        }
    }
}

final class SignInViewController: UIViewController, WKNavigationDelegate {
    private static let loginUrl = URL(string: "https://accounts.google.com/ServiceLogin?ltmpl=music&service=youtube&passive=true&continue=https%3A%2F%2Fmusic.youtube.com%2F")!
    // Google turns away sign-in from web views it recognises; this is Mobile Safari's own UA.
    private static let safariUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

    private let completion: (String?) -> Void
    private var web: WKWebView!
    private var finished = false

    init(completion: @escaping (String?) -> Void) {
        self.completion = completion
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Sign in to YouTube Music"
        view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancel))
        web = WKWebView(frame: view.bounds, configuration: WKWebViewConfiguration())
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.customUserAgent = Self.safariUA
        web.navigationDelegate = self
        view.addSubview(web)
        web.load(URLRequest(url: Self.loginUrl))
    }

    @objc private func cancel() { done(nil) }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView.url?.host == "music.youtube.com" else { return }
        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
            let youtube = cookies.filter { $0.domain.hasSuffix("youtube.com") }
            guard youtube.contains(where: { $0.name == "SAPISID" || $0.name == "__Secure-3PAPISID" }) else { return }
            self.done(youtube.map { "\($0.name)=\($0.value)" }.joined(separator: "; "))
        }
    }

    private func done(_ cookie: String?) {
        guard !finished else { return }
        finished = true
        dismiss(animated: true) { self.completion(cookie) }
    }
}
