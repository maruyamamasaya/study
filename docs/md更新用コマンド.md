```
cd "/Users/maruyamasusumuya/Library/Mobile Documents/iCloud~md~obsidian/Documents/勉強会/study" || exit 1

git pull --rebase origin main

rsync -av \
  --exclude="study/" \
  --exclude=".obsidian/" \
  --include="*/" \
  --include="*.md" \
  --exclude="*" \
  ../ docs/

mkdir -p ../training-article

cp -f \
  docs/training/README.md \
  ../training-article/README.md

rsync -av \
  docs/training/article/ \
  ../training-article/

for f in ../*.md; do
  name=$(basename "$f")
  if [ -f "docs/$name" ]; then
    if diff -q "$f" "docs/$name" > /dev/null; then
      echo "OK: $name"
    else
      echo "NG: $name"
    fi
  else
    echo "未同期: $name"
  fi
done

python3 build_note_index.py

git add docs

if ! git diff --cached --quiet; then
  git commit -m "Sync notes"
  git push origin main
else
  echo "変更なし"
fi
```
