# seiton

カメラ内の写真・動画を、プレビューを見ながら星評価で「整頓」し、ルールに従ってローカルへ取り込むデスクトップアプリです。

> Status: 開発初期。進捗は [docs/plan.md](docs/plan.md) を参照。

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

## 開発

必要なもの: Rust（stable）、Node.js 24（`.nvmrc`）、各 OS の [Tauri の前提条件](https://v2.tauri.app/start/prerequisites/)

```sh
npm ci
npm run tauri dev     # アプリを起動
npm run dev:mock      # モックデータでブラウザ上に画面を表示（http://localhost:1420）
npm run tauri:mock    # モックデータのまま Tauri アプリとして起動（複数ウィンドウの確認用）
npm test              # フロントエンドのテスト（Vitest）
npm run lint          # ESLint
cargo test --workspace   # Rust のテスト（ui/src/bindings の TypeScript 型も再生成）
cargo clippy --workspace --all-targets -- -D warnings
```

UI と Rust の間でやり取りする型は `src-tauri/src/dto.rs` で定義し、`cargo test` で `ui/src/bindings/` に TypeScript 型を生成します（ts-rs）。生成結果はコミットしてください（CI で差分を検査します）。

構成:

- `crates/` Rust のライブラリ群（設計書 §4.2）
- `src-tauri/` Tauri アプリ本体
- `ui/` React + TypeScript のフロントエンド

## ドキュメント

- [設計書 (docs/architecture.md)](docs/architecture.md)
- [実装計画 (docs/plan.md)](docs/plan.md)

## ライセンス

[MIT](LICENSE)
