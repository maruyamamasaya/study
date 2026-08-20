## 1. 今回の目的

VMware上に作成したAlmaLinux VMを使って、以下の一連の流れを実際に構築・確認した。

- VMへのIPアドレス設定
- WindowsからSSH接続
- Pythonによる簡易Webサーバー構築
- firewalldによるポート制御
- systemdによるサービス化
- SQLiteによるDB連携
- アクセスログの保存
- HTTP / HTTPS通信
- 自己署名証明書によるTLS暗号化

最終的には以下のような構成となった。

```text
Windows PC
192.168.100.134
     │
     ├── SSH :22
     │
     ├── HTTP :80
     │
     └── HTTPS :443
             ↓
┌────────────────────────────┐
│ AlmaLinux VM               │
│ 192.168.103.182            │
│                            │
│ firewalld                  │
│   ├─ ssh                   │
│   ├─ http                  │
│   └─ https                 │
│                            │
│ systemd                    │
│   ↓                        │
│ web-test.service           │
│   ↓                        │
│ server.py                  │
│   ├─ index.html            │
│   ├─ /api/logs             │
│   └─ SQLite                │
│        ↓                   │
│      test.db               │
│        ↓                   │
│      access_log            │
└────────────────────────────┘
```

---

# 2. VMの基本情報

今回使用したVM。

```text
OS       : AlmaLinux 9
Hostname : maruyama-alma-test
IP       : 192.168.103.182/24
NIC      : ens192
User     : maruyama
```

確認コマンド：

```bash
hostname
whoami
ip addr
cat /etc/os-release
```

---

# 3. WindowsからSSH接続

Windowsのコマンドプロンプトから接続。

```cmd
ssh maruyama@192.168.103.182
```

接続後、

```bash
hostname
```

結果：

```text
maruyama-alma-test
```

```bash
whoami
```

結果：

```text
maruyama
```

これにより、

```text
Windows
   ↓ SSH
TCP :22
   ↓
AlmaLinux VM
```

というリモート操作環境を構築できた。

---

# 4. 利用可能なパッケージ・コマンド確認

インターネット接続がない可能性があったため、最初にVM内に存在するツールを確認した。

```bash
command -v httpd
command -v nginx

command -v python3
command -v python
command -v perl

command -v curl
command -v wget
command -v nc
command -v ssh
command -v ss
command -v ping

command -v vi
command -v vim
command -v nano
command -v tar
command -v unzip
command -v git

command -v dnf
command -v rpm
```

主に以下が利用可能だった。

```text
Python3
Perl
curl
wget
nc
ssh
ss
ping
vi
vim
nano
tar
unzip
dnf
rpm
```

一方で、

```text
nginx
httpd
```

などのWebサーバーは入っていなかった。

そのため、追加パッケージを必要としないPython標準ライブラリを利用した。

---

# 5. Webサイト用ディレクトリ作成

ホームディレクトリ直下にWeb検証用ディレクトリを作成。

```bash
mkdir -p /home/maruyama/web-test
cd /home/maruyama/web-test
```

確認：

```bash
pwd
```

```text
/home/maruyama/web-test
```

---

# 6. Pythonで簡易Webサーバー起動

Pythonには標準で簡易HTTPサーバー機能がある。

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

これにより、

```text
0.0.0.0:8080
```

でWebサーバーが待ち受ける。

確認：

```bash
ss -lntp | grep 8080
```

---

# 7. firewalldによる8080番の許可

最初はPythonが正常に起動しているにもかかわらず、Windowsからアクセスできなかった。

firewalldを確認。

```bash
sudo firewall-cmd --state
```

```text
running
```

設定確認：

```bash
sudo firewall-cmd --list-all
```

当初許可されていたサービスは、

```text
cockpit
dhcpv6-client
ssh
```

のみであり、8080番は許可されていなかった。

一時的に8080を許可。

```bash
sudo firewall-cmd --add-port=8080/tcp
```

恒久設定：

```bash
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

確認：

```bash
sudo firewall-cmd --list-ports
```

```text
8080/tcp
```

これにより、

```text
Windows
   ↓
TCP :8080
   ↓
firewalld
   ↓
Python Web Server
```

という通信が可能になった。

---

# 8. Webページ作成

`index.html` を作成し、ブラウザから表示。

主な表示内容：

- 現在時刻
- 日付
- VMであること
- AlmaLinuxであること
- ホスト名
- IPアドレス
- Webサービス情報
- DB情報
- サーバーステータス
- アクセス履歴

ブラウザから、

```text
http://192.168.103.182:8080
```

でアクセスできることを確認した。

---

# 9. systemdによるサービス化

手動起動ではSSHを切断した場合などに管理しづらいため、Webサーバーをsystemdサービス化した。

作成ファイル：

```text
/etc/systemd/system/web-test.service
```

当初は以下の構成。

```ini
[Unit]
Description=Maruyama Test Web Server
After=network.target

[Service]
Type=simple
User=maruyama
WorkingDirectory=/home/maruyama/web-test
ExecStart=/usr/bin/python3 -m http.server 8080 --bind 0.0.0.0
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

反映：

```bash
sudo systemctl daemon-reload
sudo systemctl enable web-test
sudo systemctl restart web-test
```

状態確認：

```bash
systemctl status web-test
```

正常時：

```text
Active: active (running)
```

---

# 10. SQLiteデータベース導入

SQLiteのCLI自体は存在しなかった。

```bash
command -v sqlite3
```

ただし、

```text
sqlite-libs
perl-DBD-SQLite
```

が存在し、Python標準の`sqlite3`モジュールも利用可能だった。

確認：

```bash
python3 -c "import sqlite3; print(sqlite3.sqlite_version)"
```

そのため、PythonからSQLiteを使用する構成とした。

---

# 11. SQLiteデータベース作成

作成したDB：

```text
/home/maruyama/web-test/test.db
```

テーブル：

```text
access_log
```

構造：

```text
access_log
├─ id
├─ access_time
├─ client_ip
└─ path
```

テーブル確認：

```bash
python3 - <<'PY'
import sqlite3

conn = sqlite3.connect("test.db")

for row in conn.execute(
    "SELECT name FROM sqlite_master WHERE type='table'"
):
    print(row[0])

conn.close()
PY
```

結果：

```text
access_log
sqlite_sequence
```

`sqlite_sequence`はAUTOINCREMENTを管理するSQLite内部テーブル。

---

# 12. Python Webアプリ化

単純な、

```bash
python3 -m http.server
```

から、自作の、

```text
server.py
```

へ変更した。

構成：

```text
server.py
├─ HTTPリクエスト受付
├─ index.html返却
├─ アクセスログ保存
├─ SQLite接続
└─ /api/logs提供
```

systemdも変更。

```ini
ExecStart=/usr/bin/python3 /home/maruyama/web-test/server.py
```

反映：

```bash
sudo systemctl daemon-reload
sudo systemctl restart web-test
```

確認：

```bash
systemctl status web-test
```

実際に、

```text
/usr/bin/python3 /home/maruyama/web-test/server.py
```

がsystemd配下で起動していることを確認した。

---

# 13. アクセスログをSQLiteへ保存

ブラウザからアクセスすると、

```text
Windows
   ↓
GET /
   ↓
server.py
   ↓
INSERT
   ↓
SQLite
   ↓
test.db
```

という処理を行う。

実際のデータ例：

```text
ID | TIME                | CLIENT IP       | PATH
------------------------------------------------------------
8  | 2026-08-20 01:44:09 | 192.168.100.134 | /
7  | 2026-08-20 01:43:50 | 192.168.100.134 | /
6  | 2026-08-20 01:43:35 | 192.168.100.134 | /
```

DBを直接確認する場合：

```bash
python3 - <<'PY'
import sqlite3

conn = sqlite3.connect("test.db")

rows = conn.execute("""
SELECT id, access_time, client_ip, path
FROM access_log
ORDER BY id DESC
LIMIT 20
""")

for row in rows:
    print(row)

conn.close()
PY
```

---

# 14. アクセスログを最新10件に制限

アクセスログが無制限に増えないよう、

```text
MAX_LOGS = 10
```

とした。

新しいアクセスが発生すると、

```text
アクセス
   ↓
INSERT
   ↓
11件になる
   ↓
最も古いデータをDELETE
   ↓
最新10件だけ残す
```

という処理を実装した。

---

# 15. APIによるDBデータ取得

以下のAPIを作成。

```text
/api/logs
```

例えば、

```text
http://192.168.103.182:8080/api/logs
```

へアクセスすると、

```json
[
  {
    "id": 8,
    "time": "2026-08-20 01:44:09",
    "ip": "192.168.100.134",
    "path": "/"
  }
]
```

のようなJSONを返す。

Web画面ではJavaScriptから、

```text
fetch("/api/logs")
```

を実行し、SQLiteの内容を画面に表示している。

つまり、

```text
index.html
   ↓
JavaScript
   ↓
GET /api/logs
   ↓
server.py
   ↓
SELECT
   ↓
SQLite
   ↓
JSON
   ↓
ブラウザ表示
```

という構成になった。

---

# 16. 80番ポートへの変更

当初は、

```text
http://192.168.103.182:8080
```

だった。

通常のHTTPは80番なので、

```text
http://192.168.103.182
```

だけでアクセスできる構成へ変更した。

ただし、Linuxでは1024未満のポートを一般ユーザーが通常は利用できない。

systemdに以下を設定。

```ini
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
```

これにより、

```text
User=maruyama
```

のまま、80/443などの低位ポートを利用できるようにした。

rootでWebアプリ全体を動かすのではなく、必要な権限だけを付与している。

---

# 17. HTTPをfirewalldで許可

HTTPサービスを恒久許可。

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

これにより、

```text
http://192.168.103.182
```

でアクセス可能になった。

---

# 18. HTTPS化

OpenSSLが存在することを確認。

```bash
command -v openssl
openssl version
```

結果：

```text
/usr/bin/openssl
OpenSSL 3.0.1
```

---

# 19. 自己署名証明書作成

証明書保存先：

```text
/home/maruyama/web-test/certs
```

作成：

```bash
mkdir -p /home/maruyama/web-test/certs
cd /home/maruyama/web-test/certs
```

```bash
openssl req -x509 \
  -newkey rsa:2048 \
  -sha256 \
  -days 365 \
  -nodes \
  -keyout server.key \
  -out server.crt \
  -subj "/C=JP/ST=Tokyo/O=Lab/CN=192.168.103.182" \
  -addext "subjectAltName=IP:192.168.103.182"
```

作成されたファイル：

```text
server.crt
server.key
```

秘密鍵の権限：

```bash
chmod 600 server.key
```

証明書確認：

```bash
openssl x509 \
  -in server.crt \
  -noout \
  -subject \
  -issuer \
  -dates
```

自己署名証明書なので、

```text
subject = 192.168.103.182
issuer  = 192.168.103.182
```

となる。

---

# 20. PythonをHTTPS対応

Pythonの`ssl`モジュールを使用。

```python
import ssl
```

HTTPS用ポート：

```text
443
```

SSLContextを作成。

```python
context = ssl.SSLContext(
    ssl.PROTOCOL_TLS_SERVER
)
```

証明書と秘密鍵を読み込む。

```python
context.load_cert_chain(
    certfile="server.crt",
    keyfile="server.key"
)
```

これにより、

```text
Chrome
   ↓
HTTPS
   ↓
TCP :443
   ↓
TLS
   ↓
Python server.py
```

という通信が可能になった。

---

# 21. HTTPSをfirewalldで許可

```bash
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

確認：

```bash
sudo firewall-cmd --list-services
```

---

# 22. HTTP / HTTPS両方を利用

最終的に、

```text
HTTP  :80
HTTPS :443
```

を両方利用する構成を検証した。

確認：

```bash
ss -lntp | grep -E ':80 |:443 '
```

目標：

```text
0.0.0.0:80
0.0.0.0:443
```

アクセス：

```text
http://192.168.103.182
```

および、

```text
https://192.168.103.182
```

---

# 23. HTTPSなのにブラウザ警告が出る理由

今回使用している証明書は、

```text
自己署名証明書
```

である。

そのため、

```text
HTTPS通信          → ○
TLS暗号化          → ○
証明書             → ○
信頼されたCA発行   → ×
```

という状態。

つまり、

```text
「暗号化されていない」
```

のではなく、

```text
「Chromeが証明書の発行元を信頼していない」
```

という意味。

検証用途としては正常。

---

# 24. systemdで覚えておきたいコマンド

起動：

```bash
sudo systemctl start web-test
```

停止：

```bash
sudo systemctl stop web-test
```

再起動：

```bash
sudo systemctl restart web-test
```

状態確認：

```bash
systemctl status web-test
```

自動起動：

```bash
sudo systemctl enable web-test
```

ログ確認：

```bash
journalctl -u web-test -n 50 --no-pager
```

設定ファイルを変更した場合：

```bash
sudo systemctl daemon-reload
```

---

# 25. ネットワーク確認で覚えておきたいコマンド

IP確認：

```bash
ip addr
```

待受ポート確認：

```bash
ss -lntp
```

80/443だけ確認：

```bash
ss -lntp | grep -E ':80 |:443 '
```

firewalld確認：

```bash
sudo firewall-cmd --list-all
```

HTTP確認：

```bash
curl http://127.0.0.1
```

HTTPS確認：

```bash
curl -k https://127.0.0.1
```

---

# 26. 今回理解できた重要ポイント

## SSH

```text
SSH = Linuxサーバーをリモート操作する仕組み

Windows
   ↓ TCP 22
AlmaLinux
```

---

## ポート

同じIPアドレスでも、ポート番号によってサービスを分けられる。

```text
192.168.103.182:22
→ SSH

192.168.103.182:80
→ HTTP

192.168.103.182:443
→ HTTPS
```

---

## firewalld

サービスが起動しているだけでは外部から接続できるとは限らない。

```text
server.py
   ↓
80 LISTEN
```

だけでなく、

```text
firewalld
   ↓
80/tcp 許可
```

も必要。

---

## systemd

アプリケーションをLinuxのサービスとして管理できる。

```text
systemd
   ↓
web-test.service
   ↓
server.py
```

これにより、

- 起動
- 停止
- 再起動
- 自動起動
- 障害時再起動
- ログ確認

などができる。

---

## Web / AP / DB

今回の構成は簡易的だが、

```text
Web
↓
index.html

AP
↓
server.py

DB
↓
SQLite
```

という3つの役割を持っている。

全体では、

```text
Browser
   ↓
HTTP / HTTPS
   ↓
Python Application
   ├─ HTML
   ├─ API
   └─ SQL
        ↓
      SQLite
```

となる。

---

## HTTPとHTTPS

HTTP：

```text
Browser
   ↓
HTTP
   ↓
Web Server
```

通信内容は暗号化されない。

HTTPS：

```text
Browser
   ↓
TLS
   ↓
暗号化されたHTTP
   ↓
Web Server
```

HTTPSは単なる「443番通信」ではなく、TLSによって通信を暗号化している。

---

# 27. 今回の到達点

今回の検証によって、

```text
VM作成
 ↓
Linux設定
 ↓
IP設定
 ↓
SSH接続
 ↓
Webサーバー起動
 ↓
firewalld設定
 ↓
systemdサービス化
 ↓
Python Webアプリ化
 ↓
SQLite DB作成
 ↓
アクセスログ保存
 ↓
API作成
 ↓
HTTP :80
 ↓
TLS証明書作成
 ↓
HTTPS :443
```

まで、一連のサーバー構築を実際に確認できた。

単に「VMを起動する」だけではなく、

**OS・ネットワーク・FW・サービス・Web・アプリケーション・DB・TLSがどのようにつながっているか**

を確認できる検証環境になった。