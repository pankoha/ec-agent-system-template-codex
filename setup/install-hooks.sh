#!/usr/bin/env bash
# ============================================================
# pre-commit hook セットアップスクリプト
# ============================================================
# 実行: bash setup/install-hooks.sh
#
# - .git/hooks/pre-commit に gitleaks スキャンを仕込みます
# - gitleaks 未インストールなら brew install の案内
# - ~/.gitignore_global も設定（保険）
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [ -z "$REPO_ROOT" ]; then
    echo -e "${RED}❌ このディレクトリは git リポジトリではありません${NC}"
    echo "   まず 'git init' または 'git clone' を実行してください"
    exit 1
fi

echo -e "${GREEN}🔧 セキュリティ hook をセットアップします${NC}"
echo ""

# -------- 1. gitleaks 確認 --------
if ! command -v gitleaks >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  gitleaks が未インストールです${NC}"
    if command -v brew >/dev/null 2>&1; then
        echo "   brew でインストールします..."
        brew install gitleaks
    else
        echo "   手動インストール推奨:"
        echo "   - macOS:  brew install gitleaks"
        echo "   - Linux:  https://github.com/gitleaks/gitleaks/releases"
        echo "   - Windows: choco install gitleaks"
        exit 1
    fi
fi
echo -e "${GREEN}✓ gitleaks インストール済み ($(gitleaks version))${NC}"

# -------- 2. pre-commit hook 設置 --------
HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"
cat > "$HOOK_PATH" << 'HOOK_EOF'
#!/usr/bin/env bash
# pre-commit: gitleaks でコミット前に機密情報をスキャン
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

if ! command -v gitleaks >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  gitleaks 未インストールのためスキャンをスキップ${NC}"
    exit 0
fi

echo -e "${GREEN}🔍 gitleaks: ステージ済みファイルをスキャン中...${NC}"
if gitleaks git --staged --redact -v --no-banner 2>&1; then
    echo -e "${GREEN}✓ gitleaks: 機密情報は検出されませんでした${NC}"
    exit 0
else
    EXIT_CODE=$?
    echo ""
    echo -e "${RED}🚨 コミットを中止しました: 機密情報が検出されました${NC}"
    echo ""
    echo "対応方法:"
    echo "  1. 該当ファイルから機密情報を削除する"
    echo "  2. .gitignore に追加する（APIキー・パスワード・.env等）"
    echo "  3. 鍵が既にコミットされた疑いがあれば即座にローテーション"
    echo ""
    echo "緊急時のみバイパス（非推奨）:"
    echo "  git commit --no-verify"
    exit $EXIT_CODE
fi
HOOK_EOF
chmod +x "$HOOK_PATH"
echo -e "${GREEN}✓ pre-commit hook 設置完了: $HOOK_PATH${NC}"

# -------- 3. ~/.gitignore_global 設定（保険） --------
GLOBAL_IGNORE="$HOME/.gitignore_global"
if [ ! -f "$GLOBAL_IGNORE" ]; then
    cat > "$GLOBAL_IGNORE" << 'GI_EOF'
# Global gitignore (全リポジトリ共通の保険)
.env
.env.*
!.env.example
!.env.*.example
*.pem
*.key
id_rsa
id_rsa.*
id_ed25519
id_ed25519.*
credentials*
*secret*
*_token
*.pfx
*.p12
.DS_Store
Thumbs.db
.vscode/
.idea/
GI_EOF
    git config --global core.excludesfile "$GLOBAL_IGNORE"
    echo -e "${GREEN}✓ ~/.gitignore_global 作成＋ git 登録完了${NC}"
else
    echo -e "${GREEN}✓ ~/.gitignore_global 既存（変更せず）${NC}"
fi

# -------- 4. 動作テスト --------
echo ""
echo -e "${GREEN}🧪 hook 動作テスト${NC}"
bash "$HOOK_PATH" > /dev/null 2>&1 && echo -e "${GREEN}✓ 空スキャン正常${NC}" || echo -e "${YELLOW}⚠️ テスト失敗${NC}"

echo ""
echo -e "${GREEN}✅ セットアップ完了！${NC}"
echo ""
echo "以降、git commit するたびに自動で機密情報スキャンが走ります。"
echo ""
echo "【使い方】"
echo "  通常のコミット:  git commit -m 'your message'"
echo "  緊急バイパス:    git commit --no-verify  (非推奨・鍵漏洩リスク)"
echo ""
echo "【セキュリティルール】SECURITY.md を必ず読んでください"
