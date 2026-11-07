# NEWSの原稿と公開手順

1記事を `_content/news/event/`、`_content/news/report/`、`_content/news/blog/` のいずれかに `slug.json` として保存します。`slug` は半角英小文字・数字・ハイフンで構成し、全カテゴリーで一意にします。公開後も同じslugを使うと、詳細ページのURLを維持できます。

原稿はUTF-8のJSONです。公開可能な画像を使う場合は `assets/news/` に置き、原稿にファイルのパスと代替テキストを指定します。画像のファイル名は半角英数字・ハイフン・アンダースコアを使用します。未公開の個人情報、申込者情報、APIキーや非公開の写真は原稿やGitに保存しません。公開リポジトリでは `draft` の原稿もGit上で閲覧できるため、非公開の作業原稿はGitの管理対象外である `_drafts/` などに置きます。

## 公開

1. `status` を `published` にし、公開日と必要な項目を確認します。
2. リポジトリのルートで `node _scripts/build-news.mjs` を実行します。Node.jsの標準機能だけを使います。
3. `index.html` のNEWS欄、`news.html`、サイト内詳細の `news/<slug>.html` を確認します。`node _scripts/build-news.mjs --check` で、生成結果が現在の原稿と一致するか確認できます。
4. 原稿・画像・生成されたファイルをまとめてコミットします。公開を取り下げるときも、`draft` に戻して再生成し、古い詳細ファイルの削除を含めて反映します。

生成時点で、日本時間の今日以前の `publishedOn` を持つ `published` の記事だけを公開します。未来の日付の記事は、公開日以降に再生成したときに掲載されます。現在の更新方式は手動生成です。HOMEには先頭4件、一覧には全件を出します。公開日の降順で、同日の記事はslug順です。更新日、開催日、実施日、noteでの公開日は新着順に影響しません。

一覧と詳細は生成済みHTMLを配信します。ブラウザーが原稿フォルダーを読み込む処理はありません。絞り込みだけをJavaScriptで行うため、JavaScriptを無効にしても記事一覧と詳細は読めます。リンク・画像・CSSは相対パスです。GitHub Pagesの標準Jekyll配信では、`_content/` と `_scripts/` は公開対象外です。[GitHub PagesとJekyllの公開対象](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll)

## 共通項目

| 項目 | 内容 |
| --- | --- |
| `slug` | ファイル名と一致する一意の識別子 |
| `category` | `event`、`report`、`blog`。フォルダー名と一致させる |
| `status` | `draft` または `published` |
| `title`、`summary` | タイトルと一覧で表示する概要。BLOGでは概要が記事の紹介文になる |
| `publishedOn` | NEWSとしての公開日。`YYYY-MM-DD` |
| `updatedOn` | 任意の更新日。`YYYY-MM-DD`。公開日以降の日付を指定 |
| `thumbnail` | 任意の画像情報。`{ "src": "assets/news/cover.jpg", "alt": "画像の説明" }` |

最小の下書きには `slug`、`category`、`status` を入れます。`published` にすると、共通の必須項目とカテゴリー固有の項目を検証します。本文はプレーンテキストで保存し、改行を `\n`、段落区切りを `\n\n` で記述します。本文やタイトルにHTMLを入れても、タグは文字として表示されます。

## カテゴリー固有の項目

**EVENT** は `event` オブジェクトを持ちます。

- `startsAt` は時差を含む開催開始日時です。`YYYY-MM-DDTHH:mm+09:00` の形で指定します。終了は任意の `endsAt` です。
- `location` に場所、`description` に概要と参加方法を書きます。
- `status` は `scheduled`（開催予定）、`postponed`（延期）、`cancelled`（中止）、`completed`（開催終了）です。
- `registrationStatus` は `not-open`（受付開始前）、`open`（受付中）、`closed`（受付終了）、`not-required`（申込不要）です。
- `registrationUrl` は任意のHTTPSの申込先です。`detailUrl` を指定した場合は、HOMEと一覧からその外部案内に直接リンクします。省略した場合は、開催情報と申込先をまとめたサイト内詳細を生成します。
- 将来の連携先は任意の `source` に `{ "system": "システム名", "eventId": "外部の固定ID" }` として紐付けます。`slug` はサイトの記事のID、`system` と `eventId` の組は開催情報のIDです。

**REPORT** は `report` オブジェクトを持ちます。

- `heldOn` は活動実施日（`YYYY-MM-DD`）、`body` は活動本文、`notes` は任意の活動メモです。
- `photos` は任意の画像の配列です。各画像に `src`、`alt`、任意の `caption` を指定します。
- `links` は任意の `{ "label": "リンク名", "url": "HTTPS URL" }` の配列です。関連するnote記事もここに指定します。

**BLOG** は `blog` オブジェクトを持ちます。

- `url` に `https://note.com/` の記事URL、`notePublishedOn` にnote側の公開日を指定します。紹介文は共通の `summary`、画像は `thumbnail` を使います。
- 外部取得へ移すときに使うIDは、任意の `sourceId` に保持できます。初期の手動登録ではURLで同じ記事か確認します。取得を自動化した後も、外部IDまたは記事URLで既存の記事を更新し、サイト側の `slug` と `publishedOn` を引き継ぎます。

## 管理する場所とCMSへの移行

現時点では、運営メンバーが原稿のEVENT開催情報を管理します。外部のイベント管理を導入したら、外部IDに対応する開催日時・場所・受付状況の管理元をそのシステムに切り替えます。取り込み処理で原稿と同じデータ形式へ変換し、CMSで同じ開催情報を手入力する運用を終えます。NEWSのタイトル・紹介文・公開日・公開状態は引き続き編集側で管理します。

Pages CMS導入時は、リポジトリを接続し、ルートの `.pages.yml` にカテゴリー別のJSONコレクション、共通項目、各カテゴリーのオブジェクト項目を設定します。画像の保存先は `assets/news/` に合わせます。公開済み記事のslugは編集画面でも変更できない扱いにします。CMS保存後に `node _scripts/build-news.mjs` が実行されるよう、公開ワークフローへ生成コマンドを追加します。配信用の成果物に含めるのは、生成済みHTML、表示用CSS・JS、公開素材です。原稿と生成スクリプトは配信用の成果物から除外します。[Pages CMSのコレクション設定](https://pagescms.org/docs/configuration/content/)
