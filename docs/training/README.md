# 研修資料







---

<div class="reader-backup">
  <section class="reader-backup__item">
    <h2>全体をバックアップ</h2>
    <p>現在の学習記録をJSONファイルとして保存</p>
    <button type="button" data-backup-action="download">全体をバックアップ</button>
  </section>
  <section class="reader-backup__item">
    <h2>バックアップから上書き復元</h2>
    <p>現在の記録をバックアップ内容に置き換える</p>
    <button type="button" data-backup-action="overwrite">バックアップから上書き復元</button>
  </section>
  <section class="reader-backup__item">
    <h2>別端末の記録をマージ</h2>
    <p>現在の記録を残したまま、別端末の記録を統合する</p>
    <button type="button" data-backup-action="merge">別端末の記録をマージ</button>
  </section>
  <section class="reader-backup__item reader-backup__item--danger">
    <h2>この端末の記録をクリア</h2>
    <p>バックアップ取得後、この端末の学習記録をすべて削除する</p>
    <button type="button" data-backup-action="clear">学習記録をクリア</button>
  </section>
  <input class="reader-backup__file" type="file" accept="application/json,.json" hidden>
  <p class="reader-backup__status" role="status" aria-live="polite"></p>
  <p><a class="reader-backup__home" href="#/">トップページへ戻る</a></p>
</div>
