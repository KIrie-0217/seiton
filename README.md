# seiton

カメラ内の写真・動画を、プレビューを見ながら星評価で「整頓」し、ルールに従ってローカルへ取り込むデスクトップアプリです。

> Status: 設計段階（実装前）。現在は設計書と実装計画のみを含みます。

## 主な機能（予定）

- カメラの接続を自動で認識（USB 直結の MTP/PTP と SD カードリーダーの両方）
- サムネイル・プレビュー付きで写真・動画を一覧し、星評価を付与
  - カメラ本体で付けた評価（EXIF/XMP Rating）を読み取り、カメラ優先で同期
  - コピー元（カメラ/カード）には書き込まない
- ルールに基づく取り込み
  - 例: 星1は JPG だけ、星2は JPG と RAW の両方
  - JPG と RAW を別の保存先へ
  - 日付・時間などのフォルダテンプレート（例: `D:\RAW\{yyyy}\{MM}-{dd}`）
  - コピー後のハッシュ検証、コピー先への評価の書き込み（JPEG は XMP 埋め込み、RAW は `.xmp` サイドカー）
- 動画はアプリ内で再生（再生できない形式は OS 標準アプリで開く）

初期ターゲットは Windows と Canon のカメラです。macOS / Linux、他メーカーには順次対応します。

## 技術スタック

- [Tauri 2](https://tauri.app/) + Rust（cargo workspace）
- React + TypeScript（Vite）
- SQLite（カタログ）、[ExifTool](https://exiftool.org/)（メタデータ）

## ドキュメント

- [設計書 (docs/design.md)](docs/design.md)
- [実装計画 (docs/plan.md)](docs/plan.md)

## ライセンス

[MIT](LICENSE)
