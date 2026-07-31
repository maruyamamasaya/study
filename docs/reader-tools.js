(function () {
  'use strict';

  const JAPANESE_CHARACTERS_PER_MINUTE = 500;
  const MOBILE_HEADER_BREAKPOINT = 600;
  const HOMEPAGE_FILE = '📚 Study Notes Hub.md';
  const ARTICLE_MASTER_FILE = '_article-master.json';
  const ARTICLE_STORAGE_PREFIX = 'study-notes:article:';
  let noteIndexPromise = null;
  let articleMasterPromise = null;
  let activeArticle = null;
  let activeStartedAt = null;
  let articleLoadSequence = 0;

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

  function loadArticleMaster() {
    if (!articleMasterPromise) {
      articleMasterPromise = fetch(ARTICLE_MASTER_FILE).then(function (response) {
        if (!response.ok) {
          throw new Error('記事マスターを読み込めませんでした');
        }
        return response.json();
      });
    }

    return articleMasterPromise;
  }

  function getArticleStorageKey(articleId) {
    return ARTICLE_STORAGE_PREFIX + articleId;
  }

  function readArticleProgress(articleId) {
    const defaults = {
      version: 1,
      completed: false,
      learningSeconds: 0,
      lastViewedAt: null
    };

    try {
      const saved = JSON.parse(window.localStorage.getItem(getArticleStorageKey(articleId)) || 'null');
      return Object.assign(defaults, saved && typeof saved === 'object' ? saved : {});
    } catch (error) {
      console.warn('[Reader progress] 保存データを読み込めませんでした', error);
      return defaults;
    }
  }

  function writeArticleProgress(articleId, progress) {
    try {
      window.localStorage.setItem(getArticleStorageKey(articleId), JSON.stringify(progress));
    } catch (error) {
      console.warn('[Reader progress] 保存データを書き込めませんでした', error);
    }
  }

  function formatLearningTime(seconds) {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainder = totalSeconds % 60;

    if (hours) {
      return hours + '時間' + minutes + '分';
    }
    if (minutes) {
      return minutes + '分' + remainder + '秒';
    }
    return remainder + '秒';
  }

  function calculateOverallProgress(articles) {
    const articleProgress = articles
      .filter(function (article) {
        return article.path !== HOMEPAGE_FILE;
      })
      .map(function (article) {
        return readArticleProgress(article.id);
      });
    const completedCount = articleProgress.filter(function (progress) {
      return progress.completed;
    }).length;
    const unreadCount = articleProgress.length - completedCount;
    const totalLearningSeconds = articleProgress.reduce(function (total, progress) {
      const learningSeconds = Number(progress.learningSeconds);
      return total + (Number.isFinite(learningSeconds) && learningSeconds > 0 ? learningSeconds : 0);
    }, 0);
    const completionRate = articleProgress.length
      ? Math.round((completedCount / articleProgress.length) * 100)
      : 0;

    return {
      completedCount: completedCount,
      unreadCount: unreadCount,
      totalLearningSeconds: totalLearningSeconds,
      completionRate: completionRate
    };
  }

  function renderHomepageProgress(master) {
    if (getCurrentNotePath() !== HOMEPAGE_FILE) {
      return;
    }

    const meta = document.querySelector('.reader-meta');
    if (!meta) {
      return;
    }

    const overallProgress = calculateOverallProgress(master.articles || []);
    let summary = meta.querySelector('.reader-overall-progress');
    if (!summary) {
      summary = document.createElement('span');
      summary.className = 'reader-overall-progress';
      meta.appendChild(summary);
    }

    summary.innerHTML =
      '<span class="reader-stat">合計時間 ' +
        formatLearningTime(overallProgress.totalLearningSeconds) +
      '</span>' +
      '<span class="reader-stat">読了率 ' + overallProgress.completionRate + '%</span>' +
      '<span class="reader-stat">読了 ' + overallProgress.completedCount + '件</span>' +
      '<span class="reader-stat">未読 ' + overallProgress.unreadCount + '件</span>';
  }

  function renderArticleProgress() {
    const meta = document.querySelector('.reader-meta');
    if (!meta || !activeArticle) {
      return;
    }

    const progress = activeArticle.progress;
    const button = meta.querySelector('.reader-completion');
    const learningTime = meta.querySelector('.reader-learning-time');
    button.classList.toggle('is-completed', progress.completed);
    button.setAttribute('aria-pressed', String(progress.completed));
    button.textContent = progress.completed ? '✓ 読了' : '○ 未読了';
    learningTime.textContent = '学習 ' + formatLearningTime(progress.learningSeconds);
  }

  function flushLearningTime() {
    if (!activeArticle || activeArticle.progress.completed || activeStartedAt === null) {
      return;
    }

    const elapsedSeconds = Math.floor((Date.now() - activeStartedAt) / 1000);
    if (elapsedSeconds > 0) {
      activeArticle.progress.learningSeconds += elapsedSeconds;
      activeStartedAt += elapsedSeconds * 1000;
      writeArticleProgress(activeArticle.id, activeArticle.progress);
      renderArticleProgress();
    }
  }

  function updateLearningTimer() {
    const shouldCount = activeArticle && !activeArticle.progress.completed &&
      document.visibilityState === 'visible' && document.hasFocus();

    if (shouldCount) {
      if (activeStartedAt === null) {
        activeStartedAt = Date.now();
      }
    } else {
      flushLearningTime();
      activeStartedAt = null;
    }
  }

  function enableLearningTimer() {
    if (window.readerLearningTimer) {
      return;
    }

    document.addEventListener('visibilitychange', updateLearningTimer);
    window.addEventListener('focus', updateLearningTimer);
    window.addEventListener('blur', updateLearningTimer);
    window.addEventListener('pagehide', flushLearningTime);
    window.readerLearningTimer = window.setInterval(flushLearningTime, 1000);
  }

  function initializeArticleProgress() {
    const requestedPath = getCurrentNotePath();
    const sequence = ++articleLoadSequence;
    flushLearningTime();
    activeArticle = null;
    activeStartedAt = null;

    loadArticleMaster().then(function (master) {
      if (sequence !== articleLoadSequence) {
        return;
      }

      const article = (master.articles || []).find(function (candidate) {
        return candidate.path.replace(/\.md$/i, '') === requestedPath.replace(/\.md$/i, '');
      });
      if (!article) {
        throw new Error('記事マスターに記事がありません: ' + requestedPath);
      }

      const progress = readArticleProgress(article.id);
      progress.lastViewedAt = new Date().toISOString();
      writeArticleProgress(article.id, progress);
      activeArticle = { id: article.id, progress: progress };
      renderArticleProgress();
      renderHomepageProgress(master);
      updateLearningTimer();
    }).catch(function (error) {
      console.warn('[Reader progress]', error);
    });
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
      return HOMEPAGE_FILE;
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
    const fileName = pathParts.pop() || HOMEPAGE_FILE;
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
        '<button class="reader-completion" type="button" aria-pressed="false">○ 未読了</button>' +
        '<span class="reader-stat reader-learning-time">学習 0秒</span>' +
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

  function getChecklistStorageKey(checkbox, occurrence) {
    const item = checkbox.closest('li');
    const itemText = item ? item.textContent.replace(/\s+/g, ' ').trim() : '';

    return [
      'study-notes-checklist',
      getCurrentNotePath(),
      itemText,
      occurrence
    ].join('::');
  }

  function enablePersistentChecklists() {
    const occurrences = Object.create(null);

    document.querySelectorAll('.markdown-section input[type="checkbox"]')
      .forEach(function (checkbox) {
        const item = checkbox.closest('li');
        const itemText = item ? item.textContent.replace(/\s+/g, ' ').trim() : '';
        const occurrence = occurrences[itemText] || 0;
        const storageKey = getChecklistStorageKey(checkbox, occurrence);
        occurrences[itemText] = occurrence + 1;

        checkbox.disabled = false;
        checkbox.checked = window.localStorage.getItem(storageKey) === 'true';
        checkbox.setAttribute('aria-label', itemText || 'チェック項目');

        checkbox.addEventListener('change', function () {
          if (checkbox.checked) {
            window.localStorage.setItem(storageKey, 'true');
          } else {
            window.localStorage.removeItem(storageKey);
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
      enablePersistentChecklists();
      initializeArticleProgress();
      enableLearningTimer();
      closeTableOfContents();
    });
  }

  document.addEventListener('click', function (event) {
    if (!event.target.classList.contains('reader-completion') || !activeArticle) {
      return;
    }

    const willComplete = !activeArticle.progress.completed;
    if (willComplete) {
      flushLearningTime();
    }
    activeArticle.progress.completed = willComplete;
    writeArticleProgress(activeArticle.id, activeArticle.progress);
    renderArticleProgress();
    loadArticleMaster().then(renderHomepageProgress).catch(function (error) {
      console.warn('[Reader progress]', error);
    });
    updateLearningTimer();
  });

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (
    window.$docsify.plugins || []
  ).concat(readerToolsPlugin);
})();
