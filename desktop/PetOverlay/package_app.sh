#!/bin/sh
set -eu

PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_BUNDLE="$PACKAGE_DIR/.build/GenCityPetOverlay.app"

swift build --package-path "$PACKAGE_DIR"
BIN_DIR=$(swift build --package-path "$PACKAGE_DIR" --show-bin-path)
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources/pets"
cp "$BIN_DIR/GenCityPetOverlay" "$APP_BUNDLE/Contents/MacOS/GenCityPetOverlay"
cp "$PACKAGE_DIR"/../../public/pets/*.png "$APP_BUNDLE/Contents/Resources/pets/"
cp "$PACKAGE_DIR/../../public/pets/ATTRIBUTION.txt" "$APP_BUNDLE/Contents/Resources/pets/ATTRIBUTION.txt"
cp "$PACKAGE_DIR/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
printf 'Packaged app at %s\n' "$APP_BUNDLE"
