# クラウド（Render）への公開手順ガイド

最も手軽で無料枠がある **Render (render.com)** を使った公開手順を説明します。

## 事前準備
1. **GitHubアカウント** を作成し、このプロジェクトのファイルをアップロードしておきます。
    - 必要なファイル: `server.py`, `requirements.txt`, `Procfile`, `static/` フォルダ

## Renderでの設定手順
1. [Render](https://render.com/) にログインし、**「New +」** -> **「Web Service」** を選択します。
2. GitHubと連携し、作成したリポジトリを選択します。
3. 設定画面で以下のように入力します：
    - **Name**: `shift-scheduler-mvp` （好きな名前でOK）
    - **Environment**: `Python 3`
    - **Build Command**: `pip install -r requirements.txt`
    - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. **「Advanced」** をクリックし、**「Environment Variables」** を追加します：
    - **Key**: `AUTH_PASSWORD`
    - **Value**: `あなたの好きなパスワード`（これがログイン時のパスワードになります）
5. **「Create Web Service」** をクリックします。

## 使い方
- 公開が完了すると、`https://shift-scheduler-mvp.onrender.com` のようなURLが発行されます。
- ブラウザでアクセスすると、ログイン画面（ブラウザ標準のポップアップ）が出ます。
    - **ユーザー名**: `admin`
    - **パスワード**: 設定したパスワード
- **スマホで見たい場合**: このURLをスマホのブラウザ（SafariやChrome）で開き、「ホーム画面に追加」するとアプリのように使えます。

> [!NOTE]
> 無料プランの場合、しばらく使っていないと最初の読み込みに30秒〜1分ほどかかることがありますが、故障ではありません。
