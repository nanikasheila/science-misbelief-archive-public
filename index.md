# 事例を読む

[記事のMarkdown一覧](cases/) · [分類の定義](taxonomy.md) · [追加手順](CONTRIBUTING.md)

記事一覧・分類別索引・検索データは `cases/*.md` から自動生成します。このページには記事表を二重管理しません。

```sh
node scripts/build.mjs
```

生成先の `_site/index.html` は検索・絞り込み付きのWeb一覧、`_site/catalog.md` は全件・分類別のMarkdown索引です。記事ページと関連記事の候補も同時に生成します。生成物を手で編集したりコミットしたりする必要はありません。

**[検索・分類付きのWebサイトを開く](https://nanikasheila.github.io/science-misbelief-archive-public/)**。GitHub上では上の「記事のMarkdown一覧」から直接読めます。mainへの取り込みでWebサイトも自動更新します。仕組みは[サイトの説明](docs/site.md)を参照してください。
