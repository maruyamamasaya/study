const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('docs/obsidian-wikilinks.js', 'utf8');

async function transform(markdown, config, index) {
  const context = {
    console,
    fetch: async () => ({
      ok: true,
      json: async () => index,
    }),
    window: {
      $docsify: {},
      READER_TOOLS_CONFIG: config,
    },
  };
  vm.runInNewContext(source, context);

  const plugin = context.window.$docsify.plugins[0];
  let beforeEach;
  plugin({
    beforeEach(callback) {
      beforeEach = callback;
    },
  });

  return new Promise((resolve) => beforeEach(markdown, resolve));
}

(async () => {
  const title = 'VMware脱却について トレイニー向け説明';
  const index = {
    [title]: ['training/' + title],
  };

  const result = await transform(
    '[[' + title + ']]',
    {
      noteIndexFile: '../_note-index.json',
      pathPrefix: 'training/',
    },
    index
  );

  assert.match(result, new RegExp('href="#/' + encodeURIComponent(title) + '"'));
  assert.doesNotMatch(result, /#\/training\//);

  console.log('obsidian wiki-link tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
