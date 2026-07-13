#!/usr/bin/env bash
set -euo pipefail

url=${1:?artifact URL is required}
tag=${2:?release tag is required}
out=${3:-dist}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

curl -fsSL "$url" -o "$work/artifact"
mkdir -p "$work/extracted" "$out"

if tar -tzf "$work/artifact" >/dev/null 2>&1; then
  tar -xzf "$work/artifact" -C "$work/extracted"
elif unzip -Z1 "$work/artifact" 2>/dev/null | grep -q '\.apk$'; then
  unzip -q "$work/artifact" -d "$work/extracted"
else
  cp "$work/artifact" "$work/extracted/app-universal-release.apk"
fi

copy_apk() {
  local variant=$1 pattern=$2
  local count match
  count=$(find "$work/extracted" -type f -name "$pattern" | wc -l | tr -d ' ')
  if [[ $count -ne 1 ]]; then
    echo "Expected one $variant APK, found $count" >&2
    exit 1
  fi
  match=$(find "$work/extracted" -type f -name "$pattern" -print -quit)
  cp "$match" "$out/ArxivTok-${tag}-${variant}.apk"
}

copy_apk arm64-v8a '*arm64-v8a*release.apk'
copy_apk armeabi-v7a '*armeabi-v7a*release.apk'
copy_apk x86_64 '*x86_64*release.apk'
copy_apk universal '*universal*release.apk'

build_tools=$(find "${ANDROID_HOME:?ANDROID_HOME is required}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)
apksigner="$build_tools/apksigner"
aapt="$build_tools/aapt"

verify_abis() {
  local apk=$1 expected=$2
  local actual
  actual=$(unzip -Z1 "$apk" | sed -n 's#^lib/\([^/]*\)/.*#\1#p' | sort -u | paste -sd, -)
  if [[ "$actual" != "$expected" ]]; then
    echo "Unexpected ABIs in $apk: expected $expected, got $actual" >&2
    exit 1
  fi
}

verify_abis "$out/ArxivTok-${tag}-arm64-v8a.apk" arm64-v8a
verify_abis "$out/ArxivTok-${tag}-armeabi-v7a.apk" armeabi-v7a
verify_abis "$out/ArxivTok-${tag}-x86_64.apk" x86_64
verify_abis "$out/ArxivTok-${tag}-universal.apk" arm64-v8a,armeabi-v7a,x86,x86_64

for apk in "$out"/*.apk; do
  "$apksigner" verify "$apk"
  badging=$("$aapt" dump badging "$apk" | head -1)
  [[ "$badging" == *"name='com.arxivtok.app'"* ]] || {
    echo "Unexpected package in $apk: $badging" >&2
    exit 1
  }
  if [[ "$tag" == v* ]]; then
    version=${tag#v}
    [[ "$badging" == *"versionName='$version'"* ]] || {
      echo "Version mismatch in $apk: expected $version" >&2
      exit 1
    }
  fi
done

ls -lh "$out"/*.apk
