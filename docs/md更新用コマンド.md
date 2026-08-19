```
git pull --rebase origin main

rsync -av \
  --exclude="study/" \
  --exclude=".obsidian/" \
  --include="*/" \
  --include="*.md" \
  --exclude="*" \
  ../ docs/

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
git commit -m "Sync notes"
git push origin main
```
