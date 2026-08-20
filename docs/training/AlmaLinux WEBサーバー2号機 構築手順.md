## 1. 目的

1号機とは別に、障害時の切替先となるWEBサーバー2号機を構築する。

最終的には以下の構成を目指す。

| 項目 | 1号機 | 2号機 |
|---|---|---|
| Node | NODE-01 / 1号機 | NODE-02 / 2号機 |
| Role | PRIMARY | SECONDARY |
| OS | AlmaLinux 9 | AlmaLinux 9 |
| Hostname | maruyama-alma-01 | maruyama-alma-02 |
| IP | 192.168.103.182 | 192.168.103.183 |
| HTTP | 80 | 80 |
| HTTPS | 443 | 443 |
| Application | Python | Python |
| Database | SQLite | SQLite |

---

## 2. 現在地

以下まで完了。

- VMware上に2号機VMを作成
- AlmaLinux 9をインストール
- ユーザー `maruyama` を作成
- 固定IPを設定
  - `192.168.103.183/24`
- デフォルトゲートウェイを設定
  - `192.168.103.1`
- DNSを設定
  - `192.168.103.1`
  - `8.8.8.8`
- hostnameを設定
- SSH接続確認

2号機へSSH接続できる状態。

```bash
ssh maruyama@192.168.103.183
```

---

## 3. hostname再確認

まず2号機自身のhostnameを確認する。

```bash
hostname
```

想定結果：

```text
maruyama-alma-02
```

もし異なる場合は修正する。

```bash
sudo hostnamectl set-hostname maruyama-alma-02
```

再確認：

```bash
hostname
```

---

## 4. ネットワーク設定確認

### IPアドレス

```bash
ip -br addr
```

2号機のNICに以下が設定されていることを確認する。

```text
192.168.103.183/24
```

### デフォルトゲートウェイ

```bash
ip route
```

想定：

```text
default via 192.168.103.1
```

### DNS

```bash
cat /etc/resolv.conf
```

DNSとして以下が使用できる状態であることを確認する。

```text
192.168.103.1
8.8.8.8
```

### ゲートウェイへの疎通

```bash
ping -c 4 192.168.103.1
```

### 1号機への疎通

```bash
ping -c 4 192.168.103.182
```

ここまで成功すれば、2号機の基本的なネットワーク設定は完了。

---

## 5. WEBアプリ用ディレクトリ作成

2号機にWEBアプリを配置するディレクトリを作成する。

```bash
mkdir -p ~/web-test
cd ~/web-test
```

確認：

```bash
pwd
```

想定：

```text
/home/maruyama/web-test
```

---

## 6. 1号機とのSSH接続確認

2号機から1号機へSSH接続する。

```bash
ssh maruyama@192.168.103.182
```

接続できれば、

```bash
hostname
```

で、

```text
maruyama-alma-01
```

になっていることを確認する。

確認後、

```bash
exit
```

で2号機へ戻る。

---

## 7. 1号機からWEBアプリをコピー

2号機側で実行する。

### HTML

```bash
scp maruyama@192.168.103.182:/home/maruyama/web-test/index.html ~/web-test/
```

### CSS

```bash
scp maruyama@192.168.103.182:/home/maruyama/web-test/style.css ~/web-test/
```

### Python

```bash
scp maruyama@192.168.103.182:/home/maruyama/web-test/server.py ~/web-test/
```

コピー後に確認する。

```bash
ls -lh ~/web-test
```

以下が存在すればOK。

```text
index.html
style.css
server.py
```

### test.dbはコピーしない

1号機には、

```text
test.db
```

というSQLiteデータベースが存在する。

ただし、今回は2号機自身のアクセスログを記録したいため、1号機のDBはコピーしない。

`server.py` 起動時に2号機側で新しい `test.db` が作成される。

---

## 8. Python確認

Pythonがインストールされていることを確認する。

```bash
python3 --version
```

続いて、コピーした `server.py` の構文を確認する。

```bash
cd ~/web-test

python3 -m py_compile server.py
```

何も表示されなければ構文上は問題なし。

確認用として、

```bash
python3 -m py_compile server.py && echo "server.py: OK"
```

としてもよい。

想定：

```text
server.py: OK
```

---

## 9. HTTPS証明書作成

証明書用ディレクトリを作成する。

```bash
mkdir -p ~/web-test/certs
```

2号機用の自己署名証明書を作成する。

```bash
openssl req \
  -x509 \
  -newkey rsa:2048 \
  -nodes \
  -keyout ~/web-test/certs/server.key \
  -out ~/web-test/certs/server.crt \
  -days 365 \
  -subj "/CN=maruyama-alma-02"
```

確認：

```bash
ls -lh ~/web-test/certs
```

想定：

```text
server.crt
server.key
```

---

## 10. WEBアプリのファイル構成確認

最終的に以下のような構成になる。

```text
/home/maruyama/web-test/
├── index.html
├── style.css
├── server.py
├── test.db        ← 初回起動時に作成
└── certs/
    ├── server.crt
    └── server.key
```

`__pycache__` が作成される場合もある。

```text
__pycache__/
```

これはPythonが自動生成するものなので問題ない。

---

## 11. systemdサービス作成

2号機にも `web-test.service` を作成する。

```bash
sudo tee /etc/systemd/system/web-test.service > /dev/null <<'EOF'
[Unit]
Description=Maruyama Test Web Application
After=network.target

[Service]
Type=simple
User=maruyama
WorkingDirectory=/home/maruyama/web-test
ExecStart=/usr/bin/python3 /home/maruyama/web-test/server.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

作成された内容を確認する。

```bash
cat /etc/systemd/system/web-test.service
```

---

## 12. systemdへ反映

```bash
sudo systemctl daemon-reload
```

OS起動時にWEBアプリも自動起動するようにする。

```bash
sudo systemctl enable web-test
```

起動する。

```bash
sudo systemctl start web-test
```

状態確認：

```bash
sudo systemctl status web-test --no-pager
```

正常なら、

```text
Active: active (running)
```

となる。

---

## 13. HTTP・HTTPS待受確認

```bash
sudo ss -lntp | grep -E ':80 |:443 '
```

想定：

```text
LISTEN ... 0.0.0.0:80
LISTEN ... 0.0.0.0:443
```

両方とも `python3` がLISTENしていればOK。

---

## 14. Firewall設定

現在のFirewall設定を確認する。

```bash
sudo firewall-cmd --list-all
```

HTTPとHTTPSが許可されていなければ追加する。

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

確認：

```bash
sudo firewall-cmd --list-services
```

以下が含まれていればOK。

```text
http https
```

---

## 15. 2号機自身からHTTP確認

まずHTTP。

```bash
curl -s http://localhost/api/server-info | python3 -m json.tool
```

次にHTTPS。

```bash
curl -sk https://localhost/api/server-info | python3 -m json.tool
```

想定結果：

```json
{
    "node": "NODE-02 / 2号機",
    "role": "SECONDARY",
    "platform": "Virtual Machine",
    "os": "AlmaLinux 9.0 (Emerald Puma)",
    "hostname": "maruyama-alma-02",
    "ip": "192.168.103.183",
    "web": "HTTP / HTTPS",
    "ports": "80 / 443 TCP",
    "application": "Python server.py",
    "database": "SQLite",
    "service": "web-test.service",
    "status": "ONLINE"
}
```

ここが今回の重要ポイント。

1号機から、

```text
index.html
style.css
server.py
```

をそのままコピーしているが、画面に表示するサーバー情報はHTMLへ直接書いていない。

`server.py` が2号機自身の情報を取得して、

```text
/api/server-info
```

からJSONで返している。

そのため2号機では自動的に、

```text
NODE-02 / 2号機
SECONDARY
maruyama-alma-02
192.168.103.183
```

と表示される。

---

## 16. PCから2号機へアクセス

PCのブラウザから、

```text
http://192.168.103.183/
```

へアクセスする。

HTTPSも確認する。

```text
https://192.168.103.183/
```

自己署名証明書を使用しているため、HTTPSではブラウザから証明書警告が表示される可能性がある。

---

## 17. 1号機と2号機を比較

### 1号機

アクセス先：

```text
http://192.168.103.182/
```

想定表示：

```text
NODE-01 / 1号機
PRIMARY

Hostname
maruyama-alma-01

Private IP
192.168.103.182

Status
● ONLINE
```

### 2号機

アクセス先：

```text
http://192.168.103.183/
```

想定表示：

```text
NODE-02 / 2号機
SECONDARY

Hostname
maruyama-alma-02

Private IP
192.168.103.183

Status
● ONLINE
```

---

## 18. この構成のポイント

1号機と2号機では同じWEBアプリを使用する。

```text
index.html
style.css
server.py
```

は基本的に同じものを使用する。

一方、サーバー固有の、

- Hostname
- IPアドレス
- OS
- Node
- Role

などについては、HTMLへ直接書かず、`server.py` が実際のサーバー情報を取得する。

流れは以下。

```text
AlmaLinux
   ↓
server.py
   ↓
/api/server-info
   ↓
JSON
   ↓
index.html
   ↓
ブラウザ表示
```

そのため、同じWEBアプリを2号機へコピーしても、それぞれのサーバー自身の情報を表示できる。

---

## 19. 完成時の構成

```text
                    クライアントPC
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
       192.168.103.182          192.168.103.183
              │                       │
              ▼                       ▼
       WEBサーバー1号機          WEBサーバー2号機
              │                       │
       AlmaLinux 9               AlmaLinux 9
              │                       │
     maruyama-alma-01          maruyama-alma-02
              │                       │
          PRIMARY                 SECONDARY
              │                       │
       HTTP  :80                HTTP  :80
       HTTPS :443               HTTPS :443
              │                       │
          server.py                server.py
              │                       │
           SQLite                   SQLite
```

この時点では1号機と2号機はそれぞれ独立して動いている。

---

## 20. 次のステップ：冗長化

2号機まで完成すると、

```text
192.168.103.182
→ 1号機

192.168.103.183
→ 2号機
```

という2台のWEBサーバーが存在する状態になる。

ただし、現状では利用者がアクセス先IPを選ぶ必要がある。

例えば通常時に、

```text
http://192.168.103.182/
```

へアクセスしていた場合、1号機が停止するとアクセスできなくなる。

2号機自体は正常でも、

```text
http://192.168.103.183/
```

へ利用者がアクセス先を変更しなければならない。

そこで次の段階では、

```text
利用者
   ↓
共通のアクセス先
   ↓
1号機 PRIMARY
   ↓
障害発生
   ↓
2号機 SECONDARY
```

という構成を検討する。

---

## 21. 冗長化方式の候補

代表的には以下がある。

### DNS切替

```text
example.local
      ↓
192.168.103.182
```

障害時：

```text
example.local
      ↓
192.168.103.183
```

DNSの向き先を変更する方式。

---

### VIP（Virtual IP）

1号機・2号機とは別に、利用者がアクセスする共通IPを用意する。

例：

```text
1号機
192.168.103.182

2号機
192.168.103.183

VIP
192.168.103.xxx
```

通常時：

```text
利用者
   ↓
VIP
   ↓
1号機
```

障害時：

```text
利用者
   ↓
VIP
   ↓
2号機
```

利用者はアクセス先を変更する必要がない。

---

### Keepalived

LinuxでVIPを1号機・2号機間で切り替える方法。

イメージ：

```text
              VIP
               │
       192.168.103.xxx
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
      1号機          2号機
     PRIMARY        SECONDARY
```

通常は1号機がVIPを保持する。

1号機が停止した場合、2号機がVIPを引き継ぐ。

---

### Load Balancer

WEBサーバーの前にLBを配置する。

```text
利用者
   ↓
Load Balancer
   ↓
┌──────────┐
│          │
▼          ▼
1号機      2号機
```

LBがサーバーの状態を監視し、正常なWEBサーバーへ通信を振り分ける。

---

## 22. 今回の検証でおすすめの流れ

まず、

```text
1号機完成
   ↓
2号機完成
   ↓
2台が独立してWEB表示できることを確認
   ↓
1号機を停止してみる
   ↓
2号機自体は動いていることを確認
   ↓
共通IP（VIP）を導入
   ↓
障害時にVIPを2号機へ切替
```

という順番で進める。

最初から複雑なLBを構築するより、

**「2台のWEBサーバー」→「障害」→「なぜ切替機構が必要なのか」→「VIP」**

という順番で確認した方が、冗長化の仕組みを理解しやすい。

---

# 最終目標

最終的には、

```text
                  利用者
                    │
                    │
                    ▼
              共通IP / VIP
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
       1号機                  2号機
      PRIMARY               SECONDARY
192.168.103.182       192.168.103.183
          │                   │
          └─────────┬─────────┘
                    │
              障害時に切替
```

という構成を作り、

1. 通常は1号機へアクセス
2. 1号機で障害発生
3. 2号機へ切替
4. 利用者はアクセス先を変更しなくてよい
5. 1号機復旧後の戻し方も確認

という一連の障害切替を検証する。