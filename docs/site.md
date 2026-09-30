# サイト更新と公開境界

## 記事を追加する

1. `templates/case.md` を `cases/<slug>.md` に複製して記入する。ファイル名は小文字英数字・ハイフン。記事は `cases/` 直下に置く。
2. `node scripts/build.mjs` で検査・生成する。Node.js 22以降、追加パッケージ不要。
3. 記事の差分を確認してローカルでコミットし、mainへpushする。CIがテスト・生成し、成功するとGitHub Pagesへ自動配信する。PRでは検証と成果物の保存だけを行う。

記事ごとの許可リスト、手動の記事表、件数の設定は不要。既存カテゴリを使う限り `taxonomy.md` の変更も不要。分類そのものを新設する場合だけ、同ファイルに定義を追加する。

## 正本と生成物

正本は `cases/*.md`。`scripts/archive.mjs` が発見・解析・検査をまとめて担い、Web生成・Markdown索引・生成物検査が同じデータを使う。

| 生成先 | 内容 |
| --- | --- |
| `_site/index.html` | 件数、記事一覧、検索・分類・確認状態の絞り込み |
| `_site/catalog.md` | 全件・分類別のMarkdown索引 |
| `_site/cases/*.html` | 本文、出典、目次、関連記事 |
| `_site/search-data.js` | 記事の本文とメタデータから生成する検索データ |

ルートの `index.md` は閲覧方法への固定の入口で、記事表を持たない。詳細な索引は毎回生成する。生成物のコミットやCIからのmainへの書き戻しは行わないため、自動コミット用の権限も不要。

明示した関連記事と関連理由は本文に保持する。加えて共通カテゴリから最大3件を選び「同じ分類から読む」と表示する。明示リンクの重複を避け、分類の共有が同じ原因や結論を意味しないことを示す。

記事を削除すると次の生成で古いHTML・検索項目・自動関連記事も消える。ほかの記事に削除対象への明示リンクが残っていれば検査で停止するので、そのリンクだけは編集者が修正する。

## 公開する範囲

サイトに許可する入力の範囲は `cases/*.md`、`taxonomy.md` の分類見出し、固定の一般向け説明 `site/about.md`、CSS・検索スクリプトのみ。リポジトリを再帰コピーせず、出力ファイル一覧を構築する。`cases/` に置いた有効なMarkdownはすべてサイト掲載対象になる。`未検証候補` も警告付きで掲載する状態なので、調査途中のメモは `docs/` 等へ分ける。

**このリポジトリ自体も公開対象。** `docs/` やGit履歴、今後作成するPRもGitHubから閲覧できる。サイトに含まれないことは非公開を意味しない。秘密情報・個人データ・非公開資料はリポジトリのどこにもコミットしない。

`docs/`、監査記録、個人データ、Git情報、動画メタデータは入力にしない。記事の内部文書リンク、ローカルパス、未定義タグ、不正なメタデータ、出典番号の不一致は検査で停止する。HTMLはエスケープし、スクリプトは実行しない。出力への余分なファイル、シンボリックリンク、壊れたリンクも検査する。

記事・分類を正本にして生成するため、別の記事一覧の管理や本文の自動的な事実改変は行わない。

公開するディレクトリは検査後の `_site/` だけ。Markdown構文は段落、見出し、箇条書き、番号付き出典、引用、リンク、強調、コード表記を対象にする。記事の表やコードブロックなど未対応のブロックは、黙って崩すのではなくビルドで停止する。

## 検査

```sh
node scripts/build.mjs
node --test tests/archive.test.mjs
```

テストは一時ディレクトリで記事の追加・削除・分類/状態変更を行い、ページ、検索、分類別索引、関連記事と古い出力の削除まで確認する。公開境界と必須項目・出典・内部リンクの異常も確認する。本文の真偽や外部URLの生存は資料レビューが必要。

## 公開先と自動配信

配信先は [科学的誤認アーカイブ](https://nanikasheila.github.io/science-misbelief-archive-public/)。単一のpublicリポジトリからGitHub Pagesへ配信する。初回だけリポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定する。

[ワークフロー](../.github/workflows/check.yml)はPRとmainへのpushでテスト・ビルド・リンク検査を実行する。mainの検証成功時だけ、検査済みの `_site/` を公式Pages Actionsで配信する。手動再実行もActions画面の `Run workflow` からmainを選べば行える。失敗時には配信を進めず、Actionsの失敗した工程を確認する。

検証ジョブの権限は `contents: read`、配信ジョブだけ `pages: write` と `id-token: write` を使う。GitHubが実行ごとに発行する短期認証を利用するので、PAT・deploy key・別リポジトリ・同期用の認証情報の管理は不要。生成物をmainへ書き戻す権限も不要。

GitHub一次資料：[Pagesとカスタムワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[GITHUB_TOKENの権限範囲と有効期間](https://docs.github.com/en/actions/concepts/security/github_token)。
