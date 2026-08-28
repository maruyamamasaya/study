---
status: active
updated: 2026-08-28
---

# 現在の状態

## プロジェクト概要

このリポジトリは、主に日本語の学習ノートを Docsify で閲覧する静的サイトである。`docs/` には 341 個の Markdown ファイル（2026-08-28 調査時点）があり、ルートの Study Notes と、`docs/training/` を入口にする研修資料サイトがある。アプリケーションサーバー、データベース、API はリポジトリ内に存在しない。

## 実装済み

- Docsify による Markdown 表示と、レスポンシブな閲覧 UI。
- Obsidian 形式 Wiki リンクの解決。
- 記事タイトル検索、目次、履歴移動、テーマ、サイドバー調整、コードコピーなどの閲覧支援。
- localStorage を使った記事の完了状態・学習時間・チェックリスト、および JSON バックアップ／復元。
- 重複見出しに一意な ID を付ける Docsify プラグイン。
- ルートサイトのクライアント側パスワード画面と、パスワード画面を持たない研修サイト。
- Markdown から Wiki リンク索引と安定した記事 ID マスターを生成する Python スクリプト。
- パスワード画面と見出し ID に対する Node.js の単体テスト。

## 現在の運用

- ノート同期手順は [`docs/md更新用コマンド.md`](docs/md更新用コマンド.md) にあり、外部ディレクトリから Markdown を `docs/` に rsync して索引を再生成する。
- Git 履歴では記事同期が `Sync notes` コミットとして継続している。
- デプロイ先を明記した CI/CD 設定はリポジトリにない。`docs/.nojekyll` と静的構成は GitHub Pages と整合するが、実際の公開設定はリポジトリだけでは確認できない。

## 既知の制約・未解決事項

- `docs/password-gate.js` のパスワードは配信される JavaScript に平文で含まれる。これは閲覧 UI の抑止にすぎず、機密情報を保護する認証ではない。
- npm/package manifest、lint、typecheck、バンドル、依存関係固定、CI は存在しない。Docsify は実行時に jsDelivr CDN から読み込むため、オフラインでは完全に動作しない。
- ブラウザー UI 全体、Wiki リンク変換、reader tools、索引生成に対する自動テストは限定的または存在しない。
- 外部ノートの正本の場所・バックアップ方針、GitHub Pages の設定、対象ブラウザー、公開 URL、運用責任者はリポジトリから確認できない。
- `docs/臨時フォルダ/`、`docs/保管用・未リンク/` や名前に「無題のファイル」を含む記事は整理候補に見えるが、独立した価値と外部正本が不明なため廃止候補とは確定していない。

## 現在の優先事項・次のアクション候補

明示されたロードマップや開発中機能は見つかっていない。次回の作業ではタスクに応じて次を検討する。

1. 認証が必要なら、公開静的ファイル内のパスワードではなくホスティング層のアクセス制御要件を確認する。
2. reader tools または Wiki リンク処理を変更する際、対象機能の自動テストを追加する。
3. デプロイや同期運用を変更する前に、リポジトリ外の正本・公開設定・責任者を確認する。

## 詳細への入口

- 構成とデータフロー: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- 確認できた重要判断: [`decisions/ADR-001-static-docsify-and-generated-indexes.md`](decisions/ADR-001-static-docsify-and-generated-indexes.md)
- 今回の調査記録: [`sessions/2026-08-28-knowledge-bootstrap.md`](sessions/2026-08-28-knowledge-bootstrap.md)
