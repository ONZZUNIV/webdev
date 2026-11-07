# NEWSの原稿と公開手順

## 初回設定（リポジトリ管理者）

1. [Pages CMS](https://app.pagescms.org/) にGitHubでログインします。GitHub Appのインストール先に `ONZZUNIV`、アクセス先に `ONZZUNIV/webdev` のみを選びます。組織の設定によってはオーナーの承認が必要です。
2. Pages CMSで `ONZZUNIV/webdev` の `main` を開きます。リポジトリの `.pages.yml` から、EVENT・REPORT・BLOGと画像管理が表示されます。編集者にはGitHubでリポジトリへの書き込み権限を付与するか、Pages CMSのCollaboratorsで編集者として招待します。
3. [GitHub Pagesの設定](https://github.com/ONZZUNIV/webdev/settings/pages) で公開元を **GitHub Actions** に設定します。[Actions](https://github.com/ONZZUNIV/webdev/actions/workflows/pages.yml) の「NEWSを生成してGitHub Pagesへ公開」を `main` で実行し、公開URLで確認します。

## 記事の登録・編集（運営メンバー）

1. Pages CMSでリポジトリの `main` を開き、EVENT・REPORT・BLOGから該当する種類を選んで新規作成します。タイトル、概要、NEWS公開日と種類ごとの必須欄を入力します。EVENTの開催日時は端末のタイムゾーンで入力し、公開サイトでは日本時間に統一します。
2. サムネイルと活動写真は任意です。画像がない記事はサムネイル欄をすべて空欄にし、REPORTの「活動写真」に行を追加せず保存できます。掲載する場合は画像ごとに代替テキストを入力します。REPORTの本文欄では見出し・段落・リンク・箇条書きを編集できます。
3. 確認中は「下書き」、掲載するときは「公開」にして保存します。編集は一覧から対象記事を開いて保存します。取り下げるときは「下書き」に戻して保存します。修正した記事を新着にしない場合、NEWS公開日はそのままにして更新日を入力します。
4. [Actions](https://github.com/ONZZUNIV/webdev/actions/workflows/pages.yml) が成功したら、[HOME](https://onzzuniv.github.io/webdev/) と [NEWS一覧](https://onzzuniv.github.io/webdev/news.html) を確認します。失敗時はActionsの「NEWSを生成」ログで原稿のファイル名・項目を確認し、修正して再保存します。

公開リポジトリのため、下書き原稿とアップロード済みの画像はGitHub上で閲覧できます。未公開の個人情報、申込者情報、APIキーや非公開の写真は保存せず、非公開の作業原稿はGitの管理対象外である `_drafts/` などに置きます。活動写真はアップロード前に公開可否を確認し、位置情報などのメタデータを除去してください。表示に必要な解像度に縮小し、JPEGやWebPで1枚あたり1MB程度を目安にすると、閲覧時の転送量とリポジトリ容量を抑えられます。CMSの記事から画像の行を削除しても、画像ファイル自体は残るため、メディア管理から削除する前に他の記事での使用を確認してください。

## データ形式と生成処理

原稿はUTF-8のJSONで、カテゴリー別の `_content/news/event/`、`_content/news/report/`、`_content/news/blog/` に1記事1ファイルで保存します。CMSは新規作成時にUUIDを発行してファイル名に使い、編集時はファイル名を固定します。生成時にフォルダー名を分類、拡張子を除いたファイル名をslugとして使います。従来の `slug` と `category` を明記した原稿も読み込めます。

GitHub Actionsが `main` への保存時に原稿を読み込み、HOMEのNEWS欄、`news.html`、サイト内の詳細ページを生成します。日本時間で公開日を迎えた「公開」の原稿だけを掲載します。未来日で設定した記事は、公開日以降の定期実行（日本時間0:19を目安）または手動実行で反映されます。HOMEは最新4件、一覧は全件です。公開日の降順で、同日はslug順になります。

公開成果物にはHTML・CSS・JavaScript・公開素材を含め、原稿とCMS設定は除外します。記事と画像は相対パスで参照するため、`/webdev/` 配下で動作します。ローカルではNode.js 24とnpmで `npm ci --ignore-scripts`、`npm run build:news` の順に実行します。`npm run check:news` で生成結果を確認できます。公開用HTMLの生成はActionsで行うため、記事編集時に生成済みファイルをコミットする作業は不要です。

## 共通項目

| 項目 | 内容 |
| --- | --- |
| `slug` | ファイル名から決まる一意の識別子。原稿に指定する場合はファイル名と一致させる |
| `category` | フォルダー名から決まる分類。原稿に指定する場合はフォルダー名と一致させる |
| `status` | `draft` または `published` |
| `title`、`summary` | タイトルと一覧で表示する概要。BLOGでは概要が記事の紹介文になる |
| `publishedOn` | NEWSとしての公開日。`YYYY-MM-DD` |
| `updatedOn` | 任意の更新日。`YYYY-MM-DD`。公開日以降の日付を指定 |
| `thumbnail` | 任意の画像情報。`{ "src": "assets/news/cover.jpg", "alt": "画像の説明" }` |

`published` の原稿は、共通の必須項目とカテゴリー固有の項目を生成前に検証します。REPORTの本文のみMarkdownに対応します。HTMLタグは文字として表示します。

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

## EVENTの管理元

現時点では、運営メンバーが原稿のEVENT開催情報を管理します。外部のイベント管理を導入したら、外部IDに対応する開催日時・場所・受付状況の管理元をそのシステムに切り替えます。取り込み処理で原稿と同じデータ形式へ変換し、CMSで同じ開催情報を手入力する運用を終えます。NEWSのタイトル・紹介文・公開日・公開状態は引き続き編集側で管理します。
