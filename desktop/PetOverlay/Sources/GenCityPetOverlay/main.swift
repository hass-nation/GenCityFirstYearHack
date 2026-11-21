import AppKit
import Foundation

@MainActor
@main
enum GenCityPetOverlay {
    static func main() {
        let app = NSApplication.shared
        let delegate = OverlayAppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        withExtendedLifetime(delegate) {
            app.run()
        }
    }
}

@MainActor
final class OverlayAppDelegate: NSObject, NSApplicationDelegate {
    private var panel: NSPanel?
    private var controller: PetOverlayController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 190),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.isMovableByWindowBackground = true

        let controller = PetOverlayController(panel: panel)
        panel.contentView = controller.view
        if let screen = NSScreen.main {
            let visible = screen.visibleFrame
            panel.setFrameOrigin(NSPoint(x: visible.maxX - panel.frame.width - 22, y: visible.minY + 22))
        }
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
        panel.orderFrontRegardless()
        controller.restoreProfile()
        self.controller = controller
        self.panel = panel
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}

@MainActor
final class PetOverlayController: NSObject {
    let view = NSView()
    private weak var panel: NSPanel?
    private let root = NSStackView()
    private let bubble = NSTextField(labelWithString: "Hi! I'm Biscuit 🐶 Want to chat?")
    private let dog = NSTextField(labelWithString: "🐶")
    private let status = NSTextField(labelWithString: "")
    private let chatBody = NSTextView()
    private let profileForm = NSStackView()
    private let friendPanel = NSStackView()
    private let localChat = NSStackView()
    private let nameField = NSTextField()
    private let serverField = NSTextField()
    private let petNameField = NSTextField()
    private let friendCodeField = NSTextField()
    private let messageField = NSTextField()
    private let friendPicker = NSPopUpButton()
    private var profile: [String: Any]?
    private var token = ""
    private var serverURL = "http://127.0.0.1:5000"
    private var lastMessageId = 0
    private var timer: Timer?
    private var chatOpen = false
    private var friendsMode = false
    private var friends: [[String: Any]] = []
    private var localHistory = ["Biscuit: Hi! I'm here if you want to chat. 🐾"]
    private var remoteHistory: [String] = []

    init(panel: NSPanel) {
        self.panel = panel
        super.init()
        buildInterface()
    }

    func restoreProfile() {
        token = UserDefaults.standard.string(forKey: "gencity.token") ?? ""
        serverURL = UserDefaults.standard.string(forKey: "gencity.server") ?? serverURL
        serverField.stringValue = serverURL
        guard !token.isEmpty else { refreshHeader(); return }
        request("/api/me") { [weak self] result, _ in
            guard let self, let profile = result?["profile"] as? [String: Any] else { return }
            self.profile = profile
            self.refreshFriends()
            self.startPolling()
            self.refreshHeader()
        }
    }

    private func buildInterface() {
        view.wantsLayer = true
        root.orientation = .vertical
        root.alignment = .leading
        root.spacing = 9
        root.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(root)
        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            root.topAnchor.constraint(equalTo: view.topAnchor, constant: 12),
            root.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -12),
        ])

        bubble.font = .systemFont(ofSize: 13, weight: .medium)
        bubble.textColor = NSColor(calibratedRed: 0.2, green: 0.17, blue: 0.28, alpha: 1)
        bubble.maximumNumberOfLines = 2
        bubble.lineBreakMode = .byTruncatingTail
        bubble.alignment = .center
        bubble.wantsLayer = true
        bubble.layer?.backgroundColor = NSColor.white.cgColor
        bubble.layer?.cornerRadius = 15
        root.addArrangedSubview(bubble)

        let dogRow = NSStackView()
        dogRow.orientation = .horizontal
        dogRow.alignment = .centerY
        dogRow.spacing = 9
        dog.font = .systemFont(ofSize: 66)
        dog.alignment = .center
        dog.wantsLayer = true
        dog.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.97).cgColor
        dog.layer?.cornerRadius = 46
        dogRow.addArrangedSubview(dog)
        dogRow.addArrangedSubview(button("Chat", #selector(showPetChat)))
        dogRow.addArrangedSubview(button("Friends", #selector(showFriends)))
        dogRow.addArrangedSubview(button("Quit", #selector(quitApp)))
        root.addArrangedSubview(dogRow)

        status.font = .systemFont(ofSize: 10)
        status.textColor = .secondaryLabelColor
        root.addArrangedSubview(status)

        configureProfileForm()
        configureLocalChat()
        configureFriendPanel()
        root.addArrangedSubview(profileForm)
        root.addArrangedSubview(localChat)
        root.addArrangedSubview(friendPanel)
        profileForm.isHidden = true
        localChat.isHidden = true
        friendPanel.isHidden = true
        view.frame = NSRect(x: 0, y: 0, width: 360, height: 190)
    }

    private func configureProfileForm() {
        profileForm.orientation = .vertical
        profileForm.alignment = .leading
        profileForm.spacing = 7
        profileForm.addArrangedSubview(NSTextField(labelWithString: "Create a profile to share your pet and message friends."))
        nameField.placeholderString = "Your name"
        serverField.placeholderString = "Flask server URL"
        profileForm.addArrangedSubview(nameField)
        profileForm.addArrangedSubview(serverField)
        profileForm.addArrangedSubview(button("Create profile", #selector(createProfile)))
    }

    private func configureLocalChat() {
        localChat.orientation = .vertical
        localChat.alignment = .leading
        localChat.spacing = 7
        localChat.addArrangedSubview(customizationRow())
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        chatBody.isEditable = false
        chatBody.isSelectable = true
        chatBody.font = .systemFont(ofSize: 12)
        scroll.documentView = chatBody
        scroll.heightAnchor.constraint(equalToConstant: 110).isActive = true
        localChat.addArrangedSubview(scroll)
        let composer = NSStackView()
        composer.orientation = .horizontal
        composer.spacing = 6
        messageField.placeholderString = "Say something to your pet…"
        messageField.target = self
        messageField.action = #selector(sendToPet)
        composer.addArrangedSubview(messageField)
        composer.addArrangedSubview(button("Send", #selector(sendToPet)))
        localChat.addArrangedSubview(composer)
    }

    private func customizationRow() -> NSView {
        let column = NSStackView()
        column.orientation = .vertical
        column.alignment = .leading
        column.spacing = 5
        petNameField.placeholderString = "Pet name"
        petNameField.widthAnchor.constraint(equalToConstant: 115).isActive = true
        let nameRow = NSStackView(views: [petNameField, button("Save name", #selector(savePetName))])
        nameRow.spacing = 5
        column.addArrangedSubview(nameRow)
        let avatarRow = NSStackView()
        avatarRow.spacing = 3
        for (title, selector) in [("🐶", #selector(chooseDog)), ("🐱", #selector(chooseCat)), ("🐸", #selector(chooseFrog)), ("🦊", #selector(chooseFox)), ("🐼", #selector(choosePanda))] {
            avatarRow.addArrangedSubview(button(title, selector))
        }
        column.addArrangedSubview(avatarRow)
        let themeRow = NSStackView()
        themeRow.spacing = 4
        for (title, selector) in [("Lavender", #selector(themeLavender)), ("Meadow", #selector(themeMeadow)), ("Sunset", #selector(themeSunset))] {
            themeRow.addArrangedSubview(button(title, selector))
        }
        column.addArrangedSubview(themeRow)
        return column
    }

    private func configureFriendPanel() {
        friendPanel.orientation = .vertical
        friendPanel.alignment = .leading
        friendPanel.spacing = 7
        friendPanel.addArrangedSubview(NSTextField(labelWithString: "Share your friend code with someone you trust:"))
        friendPanel.addArrangedSubview(NSTextField(labelWithString: "Your code appears here after profile setup."))
        friendCodeField.placeholderString = "Friend code"
        let addRow = NSStackView(views: [friendCodeField, button("Add friend", #selector(addFriend))])
        addRow.spacing = 6
        friendPanel.addArrangedSubview(addRow)
        friendPicker.addItem(withTitle: "Choose a friend")
        friendPanel.addArrangedSubview(friendPicker)
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        let inbox = NSTextView()
        inbox.isEditable = false
        inbox.font = .systemFont(ofSize: 12)
        scroll.documentView = inbox
        scroll.heightAnchor.constraint(equalToConstant: 120).isActive = true
        friendPanel.addArrangedSubview(scroll)
        let composer = NSStackView()
        composer.orientation = .horizontal
        composer.spacing = 6
        let friendMessage = NSTextField()
        friendMessage.placeholderString = "Message their screen…"
        friendMessage.target = self
        friendMessage.action = #selector(sendFriendMessage(_:))
        composer.addArrangedSubview(friendMessage)
        composer.addArrangedSubview(button("Send", #selector(sendFriendMessage(_:))))
        friendPanel.addArrangedSubview(composer)
        friendPanel.addArrangedSubview(button("Refresh messages", #selector(pollMessages)))
        friendPanel.identifier = NSUserInterfaceItemIdentifier("friends")
        friendPanel.toolTip = "Friend messages appear in your floating pet bubble."
        self.inboxView = inbox
        self.friendMessageField = friendMessage
        self.friendCodeLabel = friendPanel.arrangedSubviews[1] as? NSTextField
    }

    private var inboxView = NSTextView()
    private var friendMessageField = NSTextField()
    private var friendCodeLabel: NSTextField?

    private func button(_ title: String, _ action: Selector) -> NSButton {
        let control = NSButton(title: title, target: self, action: action)
        control.bezelStyle = .rounded
        control.font = .systemFont(ofSize: 11)
        return control
    }

    private func showExpandedPanel() {
        chatOpen = true
        profileForm.isHidden = profile != nil
        localChat.isHidden = friendsMode
        friendPanel.isHidden = !friendsMode || profile == nil
        let height: CGFloat = friendsMode ? 500 : 440
        resizePanel(height: height)
    }

    private func resizePanel(height: CGFloat) {
        guard let panel else { return }
        let old = panel.frame
        panel.setFrame(NSRect(x: old.origin.x, y: old.origin.y, width: 360, height: height), display: true, animate: true)
    }

    private func refreshHeader() {
        let name = profile?["pet_name"] as? String ?? UserDefaults.standard.string(forKey: "gencity.pet_name") ?? "Biscuit"
        let avatar = profile?["pet_avatar"] as? String ?? UserDefaults.standard.string(forKey: "gencity.pet_avatar") ?? "🐶"
        let theme = profile?["pet_theme"] as? String ?? UserDefaults.standard.string(forKey: "gencity.pet_theme") ?? "lavender"
        dog.stringValue = avatar
        switch theme {
        case "meadow": dog.layer?.backgroundColor = NSColor(calibratedRed: 0.77, green: 0.91, blue: 0.79, alpha: 1).cgColor
        case "sunset": dog.layer?.backgroundColor = NSColor(calibratedRed: 1, green: 0.82, blue: 0.67, alpha: 1).cgColor
        default: dog.layer?.backgroundColor = NSColor(calibratedRed: 0.88, green: 0.84, blue: 1, alpha: 1).cgColor
        }
        bubble.stringValue = "Hi! I'm \(name) 🐶 Want to chat?"
        if let code = profile?["friend_code"] as? String { friendCodeLabel?.stringValue = "Your friend code: \(code)" }
        if petNameField.stringValue.isEmpty { petNameField.stringValue = name }
    }

    private func request(_ path: String, method: String = "GET", body: [String: String]? = nil, authenticated: Bool = true, completion: @escaping @MainActor @Sendable ([String: Any]?, String?) -> Void) {
        let base = serverURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: base + path) else { completion(nil, "Invalid server URL"); return }
        var request = URLRequest(url: url)
        request.httpMethod = method
        if authenticated && !token.isEmpty { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        URLSession.shared.dataTask(with: request) { data, response, error in
            Task { @MainActor in
                guard error == nil, let data, let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode),
                      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    completion(nil, error?.localizedDescription ?? "Server request failed")
                    return
                }
                completion(object, nil)
            }
        }.resume()
    }

    @objc private func createProfile() {
        serverURL = serverField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !serverURL.isEmpty, !nameField.stringValue.trimmingCharacters(in: .whitespaces).isEmpty else {
            status.stringValue = "Enter a name and server URL first."
            return
        }
        UserDefaults.standard.set(serverURL, forKey: "gencity.server")
        request("/api/users", method: "POST", body: ["display_name": nameField.stringValue], authenticated: false) { [weak self] result, error in
            guard let self, let result, let profile = result["profile"] as? [String: Any], let token = result["token"] as? String else {
                self?.status.stringValue = error ?? "Couldn't create your profile."
                return
            }
            self.token = token
            self.profile = profile
            UserDefaults.standard.set(token, forKey: "gencity.token")
            self.status.stringValue = "Profile ready. Share your friend code."
            self.refreshHeader()
            var savedPet: [String: String] = [:]
            if let name = UserDefaults.standard.string(forKey: "gencity.pet_name") { savedPet["pet_name"] = name }
            if let avatar = UserDefaults.standard.string(forKey: "gencity.pet_avatar") { savedPet["pet_avatar"] = avatar }
            if let theme = UserDefaults.standard.string(forKey: "gencity.pet_theme") { savedPet["pet_theme"] = theme }
            if !savedPet.isEmpty { self.updatePet(savedPet) }
            self.refreshFriends()
            self.startPolling()
            self.showFriends()
        }
    }

    private func refreshFriends() {
        request("/api/friends") { [weak self] result, error in
            guard let self else { return }
            guard let list = result?["friends"] as? [[String: Any]] else {
                if let error { self.status.stringValue = error }
                return
            }
            self.friends = list
            self.friendPicker.removeAllItems()
            for person in list {
                let name = person["display_name"] as? String ?? "Friend"
                let pet = person["pet_avatar"] as? String ?? "🐶"
                let item = self.friendPicker.menu?.addItem(withTitle: "\(pet) \(name)", action: nil, keyEquivalent: "")
                item?.representedObject = person["friend_code"] as? String
            }
            if list.isEmpty { self.friendPicker.addItem(withTitle: "Add a friend first") }
        }
    }

    private func startPolling() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.pollMessages() }
        }
        pollMessages()
    }

    @objc private func pollMessages() {
        guard !token.isEmpty else { return }
        request("/api/messages?after=\(lastMessageId)") { [weak self] result, error in
            guard let self else { return }
            guard let rows = result?["messages"] as? [[String: Any]] else {
                if let error { self.status.stringValue = error }
                return
            }
            for row in rows {
                let id = row["id"] as? Int ?? 0
                self.lastMessageId = max(self.lastMessageId, id)
                let petName = row["sender_pet_name"] as? String ?? row["sender_name"] as? String ?? "Friend"
                let avatar = row["sender_pet_avatar"] as? String ?? "🐶"
                let text = row["body"] as? String ?? ""
                let bubbleText = "\(avatar) \(petName): \(text)"
                self.remoteHistory.append(bubbleText)
                self.bubble.stringValue = bubbleText
                self.status.stringValue = "New message from \(petName)."
            }
            self.inboxView.string = self.remoteHistory.suffix(30).joined(separator: "\n\n")
        }
    }

    @objc private func addFriend() {
        guard !friendCodeField.stringValue.isEmpty else { return }
        request("/api/friends", method: "POST", body: ["friend_code": friendCodeField.stringValue]) { [weak self] result, error in
            guard let self else { return }
            if result?["friend"] != nil {
                self.status.stringValue = "Friend added. You can send them a message."
                self.friendCodeField.stringValue = ""
                self.refreshFriends()
            } else { self.status.stringValue = error ?? "Couldn't add that friend code." }
        }
    }

    @objc private func sendFriendMessage(_ sender: Any?) {
        guard let code = friendPicker.selectedItem?.representedObject as? String else {
            status.stringValue = "Choose a friend first."
            return
        }
        let text = friendMessageField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        request("/api/messages", method: "POST", body: ["friend_code": code, "body": text]) { [weak self] result, error in
            guard let self else { return }
            if result?["sent"] as? Bool == true {
                self.status.stringValue = "Message sent to their screen."
                self.friendMessageField.stringValue = ""
                self.remoteHistory.append("You: \(text)")
                self.inboxView.string = self.remoteHistory.suffix(30).joined(separator: "\n\n")
            } else { self.status.stringValue = error ?? "Couldn't send that message." }
        }
    }

    @objc private func sendToPet() {
        let text = messageField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        localHistory.append("You: \(text)")
        let lower = text.lowercased()
        let answer: String
        if lower.contains("hello") || lower.contains("hi") { answer = "Hey! It's good to see you. 🐾" }
        else if lower.contains("task") || lower.contains("study") { answer = "One little step at a time. You've got this!" }
        else if lower.contains("sad") || lower.contains("stress") { answer = "I'm here for you. Want to tell me a bit more? 💛" }
        else if lower.contains("play") || lower.contains("walk") { answer = "Did someone say play? I'm ready! 🐕" }
        else { answer = "Thanks for telling me. I'm listening! 🐶" }
        let petName = profile?["pet_name"] as? String ?? UserDefaults.standard.string(forKey: "gencity.pet_name") ?? "Biscuit"
        localHistory.append("\(petName): \(answer)")
        chatBody.string = localHistory.suffix(24).joined(separator: "\n\n")
        bubble.stringValue = answer
        messageField.stringValue = ""
    }

    private func updatePet(_ values: [String: String]) {
        guard !token.isEmpty else {
            if let name = values["pet_name"] { UserDefaults.standard.set(name, forKey: "gencity.pet_name") }
            if let avatar = values["pet_avatar"] { UserDefaults.standard.set(avatar, forKey: "gencity.pet_avatar") }
            if let theme = values["pet_theme"] { UserDefaults.standard.set(theme, forKey: "gencity.pet_theme") }
            refreshHeader()
            status.stringValue = "Pet settings saved on this Mac. Create a profile to sync with friends."
            return
        }
        request("/api/me/pet", method: "PATCH", body: values) { [weak self] result, error in
            guard let self else { return }
            if let profile = result?["profile"] as? [String: Any] {
                self.profile = profile
                self.refreshHeader()
                self.status.stringValue = "Pet settings saved."
                self.refreshFriends()
            } else { self.status.stringValue = error ?? "Couldn't save pet settings." }
        }
    }

    @objc private func savePetName() { updatePet(["pet_name": petNameField.stringValue]) }
    @objc private func chooseDog() { updatePet(["pet_avatar": "🐶"]) }
    @objc private func chooseCat() { updatePet(["pet_avatar": "🐱"]) }
    @objc private func chooseFrog() { updatePet(["pet_avatar": "🐸"]) }
    @objc private func chooseFox() { updatePet(["pet_avatar": "🦊"]) }
    @objc private func choosePanda() { updatePet(["pet_avatar": "🐼"]) }
    @objc private func themeLavender() { updatePet(["pet_theme": "lavender"]) }
    @objc private func themeMeadow() { updatePet(["pet_theme": "meadow"]) }
    @objc private func themeSunset() { updatePet(["pet_theme": "sunset"]) }

    @objc private func showPetChat() {
        if chatOpen && !friendsMode { collapsePanel(); return }
        friendsMode = false
        chatOpen = true
        profileForm.isHidden = true
        localChat.isHidden = false
        friendPanel.isHidden = true
        resizePanel(height: 440)
    }

    @objc private func showFriends() {
        if chatOpen && friendsMode { collapsePanel(); return }
        friendsMode = true
        chatOpen = true
        profileForm.isHidden = profile != nil
        localChat.isHidden = true
        friendPanel.isHidden = profile == nil
        resizePanel(height: 500)
        if profile != nil { refreshFriends() }
    }

    private func collapsePanel() {
        chatOpen = false
        profileForm.isHidden = true
        localChat.isHidden = true
        friendPanel.isHidden = true
        resizePanel(height: 190)
    }

    @objc private func quitApp() { NSApp.terminate(nil) }
}
