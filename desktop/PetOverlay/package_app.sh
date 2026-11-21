#!/bin/sh
set -eu

PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_BUNDLE="$PACKAGE_DIR/.build/GenCityPetOverlay.app"

swift build --package-path "$PACKAGE_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
cp "$PACKAGE_DIR/.build/out/Products/Debug/GenCityPetOverlay" "$APP_BUNDLE/Contents/MacOS/GenCityPetOverlay"
cp "$PACKAGE_DIR/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
printf 'Packaged app at %s\n' "$APP_BUNDLE"
