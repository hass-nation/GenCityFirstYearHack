// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "GenCityPetOverlay",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "GenCityPetOverlay", targets: ["GenCityPetOverlay"])],
    targets: [.executableTarget(name: "GenCityPetOverlay")]
)
