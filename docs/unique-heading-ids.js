(function () {
  'use strict';

  function headingToId(heading) {
    return String(heading || '')
      .trim()
      .toLowerCase()
      .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '')
      .replace(/\s+/g, '-');
  }

  function addUniqueHeadingIds(markdown) {
    const lines = String(markdown || '').split('\n');
    const headings = [];
    const reservedIds = new Set();
    let fence = '';

    lines.forEach(function (line, lineNumber) {
      const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);

      if (fenceMatch) {
        const marker = fenceMatch[1].charAt(0);
        if (!fence) {
          fence = marker;
        } else if (fence === marker) {
          fence = '';
        }
        return;
      }

      if (fence) {
        return;
      }

      const match = line.match(/^(\s{0,3}#{1,6}\s+)(.*?)(\s+#+\s*)?$/);
      if (!match) {
        return;
      }

      const title = match[2].trim();
      const explicitId = title.match(/\s+:id=([^\s]+)\s*$/);

      if (explicitId) {
        reservedIds.add(explicitId[1]);
        return;
      }

      const baseId = headingToId(title);
      if (!baseId) {
        return;
      }

      reservedIds.add(baseId);
      headings.push({
        lineNumber: lineNumber,
        prefix: match[1],
        title: title,
        closingHashes: match[3] || '',
        baseId: baseId,
      });
    });

    const occurrences = Object.create(null);
    const assignedIds = new Set();

    headings.forEach(function (heading) {
      const occurrence = (occurrences[heading.baseId] || 0) + 1;
      occurrences[heading.baseId] = occurrence;

      if (occurrence === 1 && !assignedIds.has(heading.baseId)) {
        assignedIds.add(heading.baseId);
        return;
      }

      let suffix = occurrence;
      let uniqueId = heading.baseId + '-' + suffix;
      while (reservedIds.has(uniqueId) || assignedIds.has(uniqueId)) {
        suffix += 1;
        uniqueId = heading.baseId + '-' + suffix;
      }

      assignedIds.add(uniqueId);
      lines[heading.lineNumber] =
        heading.prefix +
        heading.title +
        ' :id=' +
        uniqueId +
        heading.closingHashes;
    });

    return lines.join('\n');
  }

  function uniqueHeadingIdsPlugin(hook) {
    hook.beforeEach(function (markdown) {
      return addUniqueHeadingIds(markdown);
    });
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(
    uniqueHeadingIdsPlugin
  );
})();
