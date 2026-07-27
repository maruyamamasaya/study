(function () {
  'use strict';

  const JAPANESE_CHARACTERS_PER_MINUTE = 500;
  const MOBILE_HEADER_BREAKPOINT = 600;
  let noteIndexPromise = null;

  function loadNoteIndex() {
    if (!noteIndexPromise) {
      noteIndexPromise = fetch('_note-index.json')
        .then(function (response) {
          if (!response.ok) {
            throw new Error('ノート一覧を読み込めませんでした');
          }
          return response.json();
        });
    }

    return noteIndexPromise;
  }

  function encodeNotePath(path) {
    return String(path).split('/').map(encodeURIComponent).join('/');
  }

  function setHeaderLineContent(line, text) {
    line.innerHTML =
      '<span class="reader-header__track">' +
        '<span class="reader-header__text"></span>' +
        '<span class="reader-header__text reader-header__text--copy" aria-hidden="true"></span>' +
      '</span>';

    line.querySelectorAll('.reader-header__text').forEach(function (textElement) {
      textElement.textContent = text;
    });
  }

  function updateHeaderOverflow() {
    const header = document.querySelector('.reader-header');

    if (!header) {
      return;
    }

    header.querySelectorAll('.reader-header__path, .reader-header__title')
      .forEach(function (line) {
        const text = line.querySelector('.reader-header__text');
        const shouldScroll = window.innerWidth <= MOBILE_HEADER_BREAKPOINT &&
          text && text.scrollWidth > line.clientWidth;

        line.classList.toggle('is-overflowing', shouldScroll);
      });
  }

  function getCurrentNotePath() {
    const route = window.location.hash.replace(/^#\/?/, '').split(/[?#]/)[0];

    if (!route) {
      return 'Readme.md';
    }

    try {
      return decodeURIComponent(route);
    } catch (error) {
      return route;
    }
  }

  function updateReaderHeader() {
    let header = document.querySelector('.reader-header');

    if (!header) {
      header = document.createElement('header');
      header.className = 'reader-header';
      header.setAttribute('aria-label', '現在のノート');
      header.innerHTML =
        '<div class="reader-header__inner">' +
          '<p class="reader-header__path"></p>' +
          '<p class="reader-header__title"></p>' +
        '</div>';
      document.body.appendChild(header);
    }

    const notePath = getCurrentNotePath();
    const pathParts = notePath.split('/').filter(Boolean);
    const fileName = pathParts.pop() || 'Readme.md';
    const title = fileName.replace(/\.md$/i, '');
    const directory = pathParts.length ? pathParts.join(' / ') : 'トップ';

    setHeaderLineContent(header.querySelector('.reader-header__path'), directory);
    setHeaderLineContent(header.querySelector('.reader-header__title'), title);
    window.requestAnimationFrame(updateHeaderOverflow);
  }

  function enableHeaderOverflowUpdates() {
    if (window.readerHeaderResizeHandler) {
      return;
    }

    window.readerHeaderResizeHandler = updateHeaderOverflow;
    window.addEventListener('resize', window.readerHeaderResizeHandler);
  }

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
      '<button class="reader-navigation__button reader-search" type="button">' +
        '<span class="reader-navigation__icon" aria-hidden="true">⌕</span>' +
        '<span>検索</span>' +
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
      openTableOfContents();
    });

    navigation.querySelector('.reader-search').addEventListener('click', openSearch);

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

  function closeSearch() {
    const dialog = document.querySelector('.reader-search-dialog');
    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  function renderSearchResults() {
    const dialog = document.querySelector('.reader-search-dialog');
    const query = dialog.querySelector('.reader-search-dialog__input').value.trim().toLocaleLowerCase('ja');
    const results = dialog.querySelector('.reader-search-dialog__results');

    if (!query) {
      results.innerHTML = '<p class="reader-search-dialog__message">検索キーワードを入力してください。</p>';
      return;
    }
    results.innerHTML = '<p class="reader-search-dialog__message">検索中...</p>';
    loadNoteIndex().then(function (index) {
      const matches = [];
      Object.keys(index).forEach(function (title) {
        if (!title.toLocaleLowerCase('ja').includes(query)) {
          return;
        }

        index[title].forEach(function (path) {
          matches.push({ title: title, path: path });
        });
      });

      results.innerHTML = '';
      if (!matches.length) {
        results.innerHTML = '<p class="reader-search-dialog__message">一致するノートはありません。</p>';
        return;
      }

      matches.forEach(function (note) {
        const link = document.createElement('a');
        link.className = 'reader-search-result';
        link.href = '#/' + encodeNotePath(note.path);
        link.innerHTML = '<strong></strong><span></span>';
        link.querySelector('strong').textContent = note.title;
        link.querySelector('span').textContent = note.path;
        link.addEventListener('click', closeSearch);
        results.appendChild(link);
      });
    }).catch(function () {
      results.innerHTML = '<p class="reader-search-dialog__message">検索データを読み込めませんでした。</p>';
    });
  }

  function createSearchDialog() {
    if (document.querySelector('.reader-search-dialog')) {
      return;
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'reader-search-dialog';
    dialog.setAttribute('aria-label', 'ノートを検索');
    dialog.innerHTML =
      '<form class="reader-search-dialog__panel" method="dialog">' +
        '<header><strong>ノートを検索</strong><button value="close" aria-label="検索を閉じる">×</button></header>' +
        '<input class="reader-search-dialog__input" type="search" placeholder="タイトルを入力" aria-label="タイトルを検索" autocomplete="off">' +
        '<div class="reader-search-dialog__results" aria-live="polite"></div>' +
      '</form>';
    document.body.appendChild(dialog);

    dialog.querySelector('.reader-search-dialog__input').addEventListener('input', renderSearchResults);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        closeSearch();
      }
    });
  }

  function openSearch() {
    createSearchDialog();
    const dialog = document.querySelector('.reader-search-dialog');
    dialog.showModal();
    dialog.querySelector('.reader-search-dialog__input').focus();
  }

  function closeTableOfContents() {
    const drawer = document.querySelector('.reader-toc-drawer');
    const backdrop = document.querySelector('.reader-toc-backdrop');
    const tocButton = document.querySelector('.reader-toc');

    if (!drawer || !backdrop) {
      return;
    }

    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    tocButton.setAttribute('aria-expanded', 'false');
  }

  function openTableOfContents() {
    const drawer = document.querySelector('.reader-toc-drawer');
    const backdrop = document.querySelector('.reader-toc-backdrop');

    if (!drawer || !backdrop) {
      return;
    }

    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.querySelector('.reader-toc').setAttribute('aria-expanded', 'true');
    drawer.querySelector('.reader-toc-drawer__close').focus();
  }

  function updateTableOfContents() {
    let drawer = document.querySelector('.reader-toc-drawer');
    let backdrop = document.querySelector('.reader-toc-backdrop');

    if (!drawer) {
      backdrop = document.createElement('div');
      backdrop.className = 'reader-toc-backdrop';
      backdrop.addEventListener('click', closeTableOfContents);

      drawer = document.createElement('aside');
      drawer.className = 'reader-toc-drawer';
      drawer.setAttribute('aria-hidden', 'true');
      drawer.setAttribute('aria-label', '目次');
      drawer.innerHTML =
        '<div class="reader-toc-drawer__header">' +
          '<strong>目次</strong>' +
          '<button class="reader-toc-drawer__close" type="button" aria-label="目次を閉じる">×</button>' +
        '</div>' +
        '<nav class="reader-toc-drawer__list" aria-label="ページ内の見出し"></nav>';
      drawer.querySelector('.reader-toc-drawer__close')
        .addEventListener('click', closeTableOfContents);

      document.body.appendChild(backdrop);
      document.body.appendChild(drawer);

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          closeTableOfContents();
        }
      });
    }

    const list = drawer.querySelector('.reader-toc-drawer__list');
    const headings = document.querySelectorAll(
      '.markdown-section h1, .markdown-section h2, .markdown-section h3, .markdown-section h4'
    );
    list.innerHTML = '';

    headings.forEach(function (heading) {
      const headingAnchor = heading.querySelector('.anchor');
      const link = document.createElement('a');
      link.className = 'reader-toc-drawer__link reader-toc-drawer__link--' + heading.tagName.toLowerCase();
      link.href = headingAnchor ? headingAnchor.getAttribute('href') : '#' + heading.id;
      link.textContent = heading.textContent;
      link.addEventListener('click', closeTableOfContents);
      list.appendChild(link);
    });

    if (!headings.length) {
      list.innerHTML = '<p class="reader-toc-drawer__empty">このページには見出しがありません。</p>';
    }
  }

  function copyCodeBlock(codeBlock) {
    const text = codeBlock.textContent || '';
    const copyWithFallback = function () {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand('copy');
      textArea.remove();

      if (!copied) {
        throw new Error('Copy command was rejected');
      }
    };

    const copyPromise = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText(text).catch(copyWithFallback)
      : Promise.resolve().then(copyWithFallback);

    return copyPromise.then(function () {
      const codeContainer = codeBlock.parentElement;
      codeContainer.classList.add('is-copied');
      codeContainer.setAttribute('aria-label', 'コピーしました');

      window.setTimeout(function () {
        codeContainer.classList.remove('is-copied');
        codeContainer.setAttribute('aria-label', 'タップしてコードをコピー');
      }, 1600);
    }).catch(function () {
      codeBlock.parentElement.setAttribute(
        'aria-label',
        'コピーできませんでした。テキストを選択してコピーしてください'
      );
    });
  }

  function enableCodeBlockCopying() {
    document.querySelectorAll('.markdown-section pre > code').forEach(function (codeBlock) {
      const codeContainer = codeBlock.parentElement;

      if (codeContainer.classList.contains('is-copyable')) {
        return;
      }

      codeContainer.classList.add('is-copyable');
      codeContainer.setAttribute('role', 'button');
      codeContainer.setAttribute('tabindex', '0');
      codeContainer.setAttribute('aria-label', 'タップしてコードをコピー');
      codeContainer.addEventListener('click', function () {
        copyCodeBlock(codeBlock);
      });
      codeContainer.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          copyCodeBlock(codeBlock);
        }
      });
    });
  }

  function readerToolsPlugin(hook) {
    hook.afterEach(function (html, next) {
      next(createReaderMeta(html));
    });

    hook.doneEach(function () {
      updateReaderHeader();
      enableHeaderOverflowUpdates();
      createReaderNavigation();
      createSearchDialog();
      updateTableOfContents();
      enableCodeBlockCopying();
      closeTableOfContents();
    });
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (
    window.$docsify.plugins || []
  ).concat(readerToolsPlugin);
})();
