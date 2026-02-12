# Cantonese Rhyme MCP（粵語押韻 MCP 工具）

一個可離線運行的 MCP 工具，幫助 AI（或你）在寫廣東歌/粵語歌詞時：
- 分析每行尾韻（韻母/聲調/韻部）
- 產生押韻候選字詞（含寬韻、聲調篩選、語境加權、語氣詞偏好）
- 批量診斷整段歌詞押韻一致性，並可選擇輸出「自動改稿版本」

## 特色

- **完全離線**：不需要網路、不需要外部 API。
- **MCP 標準接入**：可被支援 MCP 的客戶端（例如 Claude Desktop、Trae、各種 MCP Host）直接調用。你可以把它理解成「讓 AI 能安全地使用你電腦上的小工具」。
- **對創作友好**：
  - 支援 **寬韻/通押**（例如 `ing ↔ eng`、`am ↔ an`）
  - 支援 **聲調類別一致性**（平/上/去）提示，降低「撞音/倒音」風險
  - 支援 **Suno 標籤過濾**（預設會跳過 `[Verse 1]` 等標籤行）
  - 候選詞可選 **語氣詞偏好**（例如「囉、喎、㗎」）

## 快速開始（給一般用戶）

你只需要做兩件事：**準備好工具檔案**，然後**把它加進你正在使用的 AI（MCP）配置**。

### 三分鐘清單（照做就能用）

1. 安裝 Node.js（建議 18+）
2. 在這個專案資料夾跑兩行指令：`npm install`、`npm run build`
3. 把下面的 MCP JSON 範例複製貼上到你的工具配置
4. 重啟你的 AI 應用（Claude Desktop / Trae 等），然後就可以叫 AI 使用本工具

### 第一步：下載並準備（只做一次）

需求：Node.js（建議 18+）。如果你未安裝，去 Node.js 官方網站下載安裝即可。

你可以用以下方式確認是否裝好（看到版本號就代表 OK）：

```bash
node -v
npm -v
```

1. 下載/複製本 repo 到你電腦（例如 `D:\Tools\cantonese-rhyme-mcp`）
2. 打開終端機（Windows 可用 PowerShell），進入該資料夾後執行：

```bash
npm install
npm run build
```

完成後就會生成 `build/index.js`（MCP server 主程式）。

### 第二步：把它加到你的 MCP 設定（可直接複製貼上）

以下是「完整 MCP JSON」範例（以 **Claude Desktop** 的 `mcpServers` 結構為例）。你只需要把路徑改成你自己的。

#### Windows 範例（推薦：用 node 直接跑 build/index.js）

```json
{
  "mcpServers": {
    "cantonese-rhyme": {
      "command": "node",
      "args": ["D:\\\\Tools\\\\cantonese-rhyme-mcp\\\\build\\\\index.js"],
      "env": {
        "CANTO_RHYME_DICT": "D:\\\\Tools\\\\cantonese-rhyme-mcp\\\\data\\\\dict.json"
      }
    }
  }
}
```

#### macOS / Linux 範例

```json
{
  "mcpServers": {
    "cantonese-rhyme": {
      "command": "node",
      "args": ["/Users/you/Tools/cantonese-rhyme-mcp/build/index.js"],
      "env": {
        "CANTO_RHYME_DICT": "/Users/you/Tools/cantonese-rhyme-mcp/data/dict.json"
      }
    }
  }
}
```

> `env.CANTO_RHYME_DICT` 可省略（預設會用 repo 內的 `data/dict.json`）。保留它的好處是：就算你把資料夾搬位，仍然容易定位/替換自訂詞庫。

#### Trae（Trae IDE）範例

在 Trae 裡面，你通常會在設定裡搜尋「MCP」，然後進入「MCP / MCP Servers」新增一個 server。把以下內容照填即可（本質上就是填 `command / args / env`）。

**Windows（Trae）**

```json
{
  "name": "cantonese-rhyme",
  "command": "node",
  "args": ["D:\\\\Tools\\\\cantonese-rhyme-mcp\\\\build\\\\index.js"],
  "env": {
    "CANTO_RHYME_DICT": "D:\\\\Tools\\\\cantonese-rhyme-mcp\\\\data\\\\dict.json"
  }
}
```

**macOS / Linux（Trae）**

```json
{
  "name": "cantonese-rhyme",
  "command": "node",
  "args": ["/Users/you/Tools/cantonese-rhyme-mcp/build/index.js"],
  "env": {
    "CANTO_RHYME_DICT": "/Users/you/Tools/cantonese-rhyme-mcp/data/dict.json"
  }
}
```

> Trae 的 UI/檔案欄位名稱可能略有不同，但只要概念對應到 `command / args / env` 就可以正常運作。

#### 配置檔位置（常見）

不同 MCP Host 的設定檔位置不一樣，但通常你會在該 Host 的「Settings / Developer / MCP」頁面找到入口。

以 Claude Desktop 常見位置為例：
- Windows：`%APPDATA%\Claude\claude_desktop_config.json`
- macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`

### 第三步：重啟（很重要）

- 修改 MCP 設定後，請**重啟 MCP Host**（例如重啟 Claude Desktop），它才會載入新工具。
- 更新本工具程式碼（尤其新增/修改工具參數）後，也請**重啟 MCP Host / MCP Server**。

## 範例：讓 AI 用工具生成押韻歌詞（提示詞 + 示範回應）

下面提供一個「你可以直接貼給 AI」的提示詞模板，以及一段符合流程的示範回應。重點係：**AI 會先寫，再用工具檢查，唔啱就用工具修正**，而唔係靠估。

### 你可以直接貼給 AI 的提示詞（Template）

把 `<...>` 內容改成你想要的主題/風格就得。

```text
你而家可以使用 Cantonese Rhyme MCP 工具。請你寫一段粵語歌詞，並確保押韻與協音盡量自然。

要求：
1) 主題：<星空下城市漫步>
2) 段落：8 行（兩段，每段 4 行）
3) 押韻方案：AABBCCDD
4) 押韻嚴格度：先用 strictness=finalTone（太窄先退到 wide）
5) 協音檢查：toneConsistency=class
6) 語感：香港口語、唔好太書面
7) 流程（必做）：
   - 先寫出初稿
   - 用 cantonese_rhyme_diagnose_lyrics 檢查（帶 scheme、toneConsistency、ignoreBracketTags=true）
   - 如果有不押韻或 tone 風險：用 cantonese_rhyme_candidates 找替代尾字/尾詞修正，必要時再跑一次 diagnose
   - 最後輸出「最終歌詞」一份

加分：
- contextKeywords 用：星空、城市、路燈、夜風、漫步
```

### 示範回應（節錄）

以下示範一個「AI 正確使用工具」的回應型態（為了可讀性，工具輸出只節錄關鍵欄位）。

1) 初稿（AABBCCDD，先嘗試以 `ou` 韻收尾）

```text
霓虹落喺玻璃窗邊閃住步
夜風貼近領口偷笑跟我步
喧嘩喺背後慢慢退成霧
剩低心跳同星光照住路

路燈拖長影子陪我行到舊
想講嘅說話喺喉嚨打個結舊
你嘅名字喺腦海轉兩圈又
抬頭望到星空，仍然未夠
```

2) 用工具批量檢查押韻/協音（示範呼叫）

```json
{
  "lyrics": "霓虹落喺玻璃窗邊閃住步\n夜風貼近領口偷笑跟我步\n喧嘩喺背後慢慢退成霧\n剩低心跳同星光照住路\n\n路燈拖長影子陪我行到舊\n想講嘅說話喺喉嚨打個結舊\n你嘅名字喺腦海轉兩圈又\n抬頭望到星空，仍然未夠",
  "strictness": "finalTone",
  "scheme": "AABBCCDD",
  "toneConsistency": "class",
  "ignoreBracketTags": true,
  "contextKeywords": ["星空", "城市", "路燈", "夜風", "漫步"]
}
```

示範結果（節錄）：

```json
{
  "summary": {
    "okLineCount": 6,
    "mismatchLineCount": 2,
    "toneRiskLines": [7],
    "skippedTagLines": []
  },
  "results": [
    { "line": 1, "end": { "matchedText": "步", "final": "ou", "tone": 6 }, "ok": true },
    { "line": 2, "end": { "matchedText": "步", "final": "ou", "tone": 6 }, "ok": true },
    { "line": 3, "end": { "matchedText": "霧", "final": "ou", "tone": 6 }, "ok": true },
    { "line": 4, "end": { "matchedText": "路", "final": "ou", "tone": 6 }, "ok": true },
    { "line": 7, "end": { "matchedText": "又", "final": "au", "tone": 6 }, "ok": false, "toneRisk": true },
    { "line": 8, "end": { "matchedText": "夠", "final": "au", "tone": 3 }, "ok": false }
  ]
}
```

3) 針對不押韻的行（第 7/8 行），用候選工具改尾字（示範呼叫）

例如我希望第 7/8 行都改回 `ou6`（同「路/步/霧」一致），就可以查 `rhymeKey="ou6"`：

```json
{
  "rhymeKey": "ou6",
  "strictness": "finalTone",
  "preferStyle": "content",
  "limit": 20,
  "contextKeywords": ["星空", "城市", "路燈", "夜風", "漫步"]
}
```

示範候選（節錄）：

```json
{
  "rhymeKey": "ou6",
  "strictness": "finalTone",
  "candidates": [
    { "text": "路", "jyutping": "lou6" },
    { "text": "步", "jyutping": "bou6" },
    { "text": "霧", "jyutping": "mou6" },
    { "text": "度", "jyutping": "dou6" }
  ]
}
```

4) 修正後最終歌詞（把第 7/8 行尾改回 `ou6`，再跑一次 diagnose 直到 mismatch=0）

```text
霓虹落喺玻璃窗邊閃住步
夜風貼近領口偷笑跟我步
喧嘩喺背後慢慢退成霧
剩低心跳同星光照住路

路燈拖長影子陪我行到舊
想講嘅說話喺喉嚨打個結舊
你嘅名字喺腦海轉兩圈度
抬頭望到星空，仍然未夠路
```

> 提示：如果你覺得 `finalTone` 太難寫得順，可以把 `strictness` 退到 `wide`，讓 AI 有更多可用尾字，但仍然保持「聽感接近」。

## 作為 MCP Server 使用（給進階用戶）

本專案已在 `package.json` 提供可執行入口：
- `npm start`：`node build/index.js`
- CLI bin：`cantonese-rhyme-mcp`（對應 `./build/index.js`）

### 方式 A：直接用 node 啟動（最簡單、最不易出錯）

在你的 MCP Host 配置中，使用：
- command：`node`
- args：`["<你的專案路徑>/build/index.js"]`

### 方式 B：用 npm link（讓系統出現 `cantonese-rhyme-mcp` 指令）

```bash
npm install
npm run build
npm link
```

之後在 MCP Host 配置中可用：
- command：`cantonese-rhyme-mcp`
- args：`[]`

## MCP 工具清單

### 1) `cantonese_rhyme_analyze_end`

輸入一行文字，分析行尾韻腳。

**輸入**
- `text: string`

**輸出（重要欄位）**
- `matchedText`：命中的尾詞/尾字
- `matchedJyutping`：命中的粵拼
- `final` / `tone`：韻母/聲調
- `rhymeKeys.final` / `rhymeKeys.finalTone` / `rhymeKeys.group`
- `unmatchedTail`：無法解析的尾部（用於快速定位問題）

### 2) `cantonese_rhyme_candidates`

以韻鍵查詢押韻候選字詞，並可做聲調與語境排序。

**輸入**
- `rhymeKey: string`：韻鍵（例如 `ou`、`ou6`、`aan`）
- `strictness: "final" | "finalTone" | "group" | "wide"`（預設 `final`）
  - `final`：同韻母
  - `finalTone`：同韻母 + 同聲調
  - `group`：較寬鬆的韻部歸類
  - `wide`：寬韻/通押（例如 `ing ↔ eng`）
- `preferStyle?: "balanced" | "content" | "particle"`
  - `balanced`：均衡（預設）
  - `content`：偏向實詞（較少把語氣詞排最前）
  - `particle`：偏向語氣詞（更容易推薦「喎/囉/㗎」等句尾）
- 其他可選：
  - `limit?: number`（1~200）
  - `excludeTexts?: string[]`
  - `preferredCharLength?: number`
  - `tone?: string | number`
  - `tones?: Array<string | number>`
  - `toneClass?: "level" | "rising" | "departing"`
  - `context?: string`
  - `contextKeywords?: string[]`

### 3) `cantonese_rhyme_diagnose_lyrics`

分析整段歌詞的押韻一致性，支援分段方案（AABB...）、聲調一致性提示，並可輸出自動改稿版本。

**輸入**
- `lyrics: string`
- `strictness: "final" | "finalTone" | "group" | "wide"`（預設 `final`）
- `scheme?: string`：押韻方案，例如 `AABB`、`A,B,A,B`
- `toneConsistency?: "none" | "class" | "exact"`
  - `class`：同一組盡量保持聲調類別一致（預設）
  - `exact`：同一組盡量保持聲調數字一致（更嚴格）
- `ignoreBracketTags?: boolean`（預設 `true`）
  - `true`：會跳過 `[Verse 1]`、`[Chorus]` 這類整行標籤
- 改稿相關：
  - `rewrite?: boolean`（預設 `false`）
  - `rewriteSuggestionLimit?: number`（1~200，預設 40）
- 其他可選：
  - `suggestionLimit?: number`（1~50）
  - `preferredCharLength?: number`
  - `context?: string`
  - `contextKeywords?: string[]`

**輸出（重要欄位）**
- `summary`：整體統計（含 `toneRiskLines`、`skippedTagLines`、`rewriteChangeCount`）
- `groups`：按 A/B/C… 分組摘要（每組目標韻、錯配數、聲調分佈）
- `results`：逐行結果（含 `ok`、`toneRisk`、`suggestions`）
- `rewrite`（當 `rewrite:true`）：改稿版歌詞與逐行改動清單

> 注意：`rewrite` 目前是「聲韻/長度/語境排序優先」的自動替換，**不保證語意一定最順**。建議把它當作「快速出草稿」或「幫你把韻腳先對齊」，再由你做最後潤色。

## 開發與測試

```bash
npm run dev       # 用 tsx 直接跑 src/index.ts（開發用）
npm run typecheck # TypeScript 型別檢查
npm run build     # 編譯到 build/
npm test          # 跑測試（Node test runner）
npm run lint      # 目前等同 typecheck
```

## 資料來源與授權（重要）

- 本工具使用 `to-jyutping` 作為主要離線粵拼來源（依賴套件授權請以其官方資訊為準）。
- 本 repo 內含 `data/dict.json`（本地詞庫）。一般個人/團隊在本機使用通常不會有問題；但如果你打算把整個 repo 公開發佈、讓別人再分發，建議先確認該檔案內容的可再分發授權，避免日後授權爭議。
- 本專案程式碼採用 MIT License（見 `LICENSE`）。`data/` 內的字典資料可能適用不同授權條款；如需再分發，請先確認其來源與授權。

