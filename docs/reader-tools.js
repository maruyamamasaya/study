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

  function createReaderNavigation() {
    if (document.querySelector('.reader-navigation')) {
      return;
    }

    const navigation = document.createElement('nav');
    navigation.className = 'reader-navigation';
    navigation.setAttribute('aria-label', 'ページ操作');
    navigation.innerHTML =
      '<button class="reader-navigation__button reader-toc" type="button">' +
        '<span class="reader-navigation__icon" aria-hidden="true">☰</span>' +
        '<span>目次</span>' +
      '</button>' +
      '<button class="reader-navigation__button reader-back" type="button">' +
        '<span class="reader-navigation__icon" aria-hidden="true">←</span>' +
        '<span>戻る</span>' +
      '</button>' +
      '<a class="reader-navigation__button reader-home" href="#/">' +
        '<span class="reader-navigation__icon" aria-hidden="true">⌂</span>' +
        '<span>ホーム</span>' +
      '</a>' +
      '<button class="reader-navigation__button reader-forward" type="button">' +
        '<span class="reader-navigation__icon" aria-hidden="true">→</span>' +
        '<span>次に進む</span>' +
      '</button>';

    document.body.appendChild(navigation);

    navigation.querySelector('.reader-toc').addEventListener('click', function () {
      const sidebarToggle = document.querySelector('.sidebar-toggle');

      if (sidebarToggle) {
        sidebarToggle.click();
      }
    });

    navigation.querySelector('.reader-back').addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }

      window.location.hash = '#/';
    });

    navigation.querySelector('.reader-forward').addEventListener('click', function () {
      window.history.forward();
    });
  }

  function readerToolsPlugin(hook) {
    hook.afterEach(function (html, next) {
      next(createReaderMeta(html));
    });

    hook.doneEach(function () {
      createReaderNavigation();
    });
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (
    window.$docsify.plugins || []
  ).concat(readerToolsPlugin);
})();
