(function () {
  'use strict';

  const JAPANESE_CHARACTERS_PER_MINUTE = 500;

  function createReaderMeta(content) {
    const temporaryElement = document.createElement('div');
    temporaryElement.innerHTML = content;

    const text = (temporaryElement.textContent || '')
      .replace(/\s+/g, '')
      .trim();
    const characterCount = text.length;
    const readingMinutes = Math.max(
      1,
      Math.ceil(characterCount / JAPANESE_CHARACTERS_PER_MINUTE)
    );

    return (
      '<nav class="reader-meta" aria-label="記事情報">' +
        '<button class="reader-back" type="button" aria-label="前のページに戻る">' +
          '<span aria-hidden="true">←</span> 戻る' +
        '</button>' +
        '<span class="reader-stat" title="1分あたり約500文字で計算">' +
          '<span aria-hidden="true">◷</span> 約' + readingMinutes + '分' +
        '</span>' +
        '<span class="reader-stat">' +
          characterCount.toLocaleString('ja-JP') + '文字' +
        '</span>' +
      '</nav>' +
      content
    );
  }

  function readerToolsPlugin(hook) {
    hook.afterEach(function (html, next) {
      next(createReaderMeta(html));
    });

    hook.doneEach(function () {
      const backButton = document.querySelector('.reader-back');

      if (!backButton) {
        return;
      }

      backButton.addEventListener('click', function () {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }

        window.location.hash = '#/';
      });
    });
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (
    window.$docsify.plugins || []
  ).concat(readerToolsPlugin);
})();
