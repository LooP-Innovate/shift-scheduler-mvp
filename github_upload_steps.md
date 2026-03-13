# GitHubへのアップロード手順

GitHubアカウントをお持ちとのことですので、以下の手順で現在のプログラムをアップロード（Push）してください。

## 1. GitHubで新しいリポジトリを作成する
1. [GitHub](https://github.com/) にログインします。
2. 右上の「+」ボタンから **「New repository」** を選択します。
3. **Repository name** に `shift-scheduler-mvp` （任意）と入力します。
4. **Public** か **Private** を選びます（PrivateでもRenderと連携可能です）。
5. 「Create repository」をクリックします。

## 2. PCからアップロードする
現在のフォルダ（`c:\Users\akubi\OneDrive\Desktop\shift-scheduler-mvp`）で、以下のコマンドをターミナルで実行します。

```powershell
# 1. gitの初期化
git init

# 2. すべてのファイルを追加
git add .

# 3. 最初のコミット
git commit -m "Initialize shift scheduler mvp"

# 4. メインブランチに移動
git branch -M main

# 5. GitHubのリポジトリと紐付け（URLは作成したものに書き換えてください）
git remote add origin https://github.com/あなたのユーザー名/shift-scheduler-mvp.git

# 6. アップロード
git push -u origin main
```

## 3. Renderと連携する
アップロードが終わったら、前回のガイド（ [deployment_guide.md](file:///c:/Users/akubi/OneDrive/Desktop/shift-scheduler-mvp/deployment_guide.md) ）の「Renderでの設定手順」に進んでください。

> [!TIP]
> もしGitの操作が不安な場合は、GitHubのウェブサイト上で「uploading an existing file」というリンクをクリックして、ファイルを直接ドラッグ＆ドロップでアップロードすることも可能です！
