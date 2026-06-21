# PTES Frontend (Prototype v0.1)

React SPA prototype of the **個人技術棧演進圖譜系統 (Personal Tech-Stack Evolution System)**, implementing the UI surface defined in SRS §2.5.1.

## 啟動

### 前端

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 產生靜態檔
```

預設使用真實後端 API。若要在無後端時以 mock 資料開發，可設定：

```bash
# Windows PowerShell
$env:VITE_USE_MOCK="true"; npm run dev
```

### 後端

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env   # 填入 GitHub OAuth 憑證
python -m uvicorn app.main:app --reload --port 8000
```

同時啟動前後端後，前端會透過 Vite proxy 將 `/api` 轉發至 `http://localhost:8000`。

最小視域：1024px（依 SRS §2.5.1）。

## GitHub OAuth 設定（SRS §2.5.2）

1. 至 [GitHub Developer Settings](https://github.com/settings/developers) 建立 **OAuth App**
2. **Authorization callback URL** 設為：`http://localhost:8000/api/v1/github/callback`
3. 將 Client ID / Client Secret 填入 `backend/.env`：

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:8000/api/v1/github/callback
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./ptes.db
```

4. 在 sidebar 底部切換使用者，或點「連結 GitHub 帳號」/「從 GitHub 匯入」

匯入欄位：`name`, `description`, `created_at`, `updated_at`；同一 profile 下已匯入過的 repository（以 `github_repo_id` 判斷）不會重複建立。

## 加入 GitHub 使用者（公開 API，無需 OAuth）

在 sidebar 底部「目前使用者」：

1. 輸入 GitHub username（例如 `torvalds`）
2. 點「加入使用者」
3. profile-trigger 會顯示真實 **name**（如 Linus Torvalds）、**頭像** 與 `@torvalds`
4. 切換到該 profile 後，可在「從 GitHub 匯入」列出其 public repositories

匯入 repository 時，後端會呼叫 GitHub Languages API，將占比 ≥ 1% 的程式語言自動對應為標籤（優先比對同名標籤，否則建立於「Languages」父標籤下），並與你選的預設標籤合併。

後端呼叫 GitHub 公開 API（`GET /users/{username}`、`GET /users/{username}/repos`）。未認證時 rate limit 為每小時 60 次；可在 `backend/.env` 設定可選的 `GITHUB_PAT` 提高配額。

| 方式 | 用途 |
|------|------|
| **公開 username 查詢** | 檢視任意 public GitHub 使用者（如 torvalds）的 repos |
| **OAuth** | 連結「自己的」GitHub 帳號（sidebar「OAuth 連結自己的帳號」） |

## 多 GitHub 使用者切換

每位 GitHub 使用者（或本機示範 profile）擁有**獨立的標籤樹、專案、熱點圖與報告**：

1. Sidebar 底部「目前使用者」可切換 profile（種子資料含 `本機示範`、`demo-user`、`alice-dev`、`torvalds`）
2. 輸入 username 加入更多 public GitHub 使用者，或 OAuth 連結自己的帳號
3. 前端所有 CRUD 請求會帶 `X-PTES-Profile-Id` header，後端只回傳該 profile 的資料
4. OAuth 完成後會 redirect 至 `/projects?github=connected&profile={id}` 並自動切換

## 儀表板 GitHub 活動同步

進入 `/dashboard` 時，若目前 profile 有 GitHub username，後端會透過 **GitHub GraphQL `contributionsCollection`** 查詢各已匯入 repository 的 commit 貢獻日期（與 GitHub 個人頁熱力圖相同邏輯），寫入專案 `activity_dates`，再聚合為熱點圖。

- 查詢範圍：自 `2023-01-01` 起至現在；只統計**已匯入 PTES 的 repos**
- 節流：同一 profile 30 分鐘內不重複同步（Dashboard「強制重新同步」或 `?force=true` 可跳過）
- 匯入 repository 時也會自動同步該批專案的 commit 活動；若同步失敗，匯入結果與 Dashboard 會顯示警告
- **公開 username 模式**（無 OAuth）仍可同步 public repo 的貢獻，但 GraphQL 配額極低，**強烈建議**在 `backend/.env` 設定 `GITHUB_PAT`；OAuth 連結自己的帳號可存取 private repo 貢獻
- 若 `contributionsCollection` 未涵蓋某 repo，會 fallback 至 default branch commit history（小型 repo 適用）

若從舊版 DB 升級，請刪除 `backend/ptes.db` 後重啟後端以套用新 schema（需含 `avatar_url` 欄位）。

## Gemini AI 技術總結（US-04）

技術總結頁面預設由 **Google Gemini** 依 profile 專案資料產生 Markdown 報告。

1. 至 [Google AI Studio](https://aistudio.google.com/apikey) 取得 API Key
2. 填入 `backend/.env`：

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
```

3. 重啟後端

**Fallback 行為**：未設定 `GEMINI_API_KEY` 或 AI 呼叫失敗時，自動改用固定模板產生報告（與舊版行為相同）。前端會顯示產生來源（AI / 模板）。

建議模型：`gemini-2.5-flash`（目前免費層可用）。`gemini-2.0-flash` 部分帳號已無免費配額，若遇到 429 錯誤請改為 `gemini-2.5-flash`。

## 頁面對照表

| 路由           | 視圖           | 對應使用者故事         |
| -------------- | -------------- | ---------------------- |
| `/dashboard`   | 儀表板（熱點圖）| US-03                  |
| `/projects`    | 專案管理        | US-01, US-05, US-06   |
| `/tags`        | 標籤管理        | US-02                  |
| `/reports`     | 技術總結        | US-04                  |

## API 接口

所有後端呼叫集中在 `src/api/client.js`（GitHub 相關在 `src/api/github.js`）。`VITE_USE_MOCK=true` 時以記憶體 mock 模擬 CRUD。

### 核心 REST（SRS §2.5.3）

| 方法   | 路徑                       | 說明                             |
| ------ | -------------------------- | -------------------------------- |
| GET    | `/api/v1/profiles`         | 列出所有 profile（不需 profile header） |
| POST   | `/api/v1/profiles/from-github` | 依 username 建立/更新 profile（公開 API） |
| DELETE | `/api/v1/profiles/{id}`    | 刪除 profile 及其資料                   |
| GET    | `/api/v1/projects`         | 取得所有專案（支援查詢參數篩選） |
| POST   | `/api/v1/projects`         | 建立新的專案紀錄                 |
| GET    | `/api/v1/projects/{id}`    | 依 ID 取得單一專案               |
| PUT    | `/api/v1/projects/{id}`    | 更新現有專案                     |
| DELETE | `/api/v1/projects/{id}`    | 刪除專案                         |
| GET    | `/api/tags`                | 取得完整標籤階層結構             |
| POST   | `/api/tags`                | 建立新標籤                       |
| PUT    | `/api/tags/{id}`           | 更新標籤（重新命名或變更父節點） |
| DELETE | `/api/tags/{id}`           | 刪除標籤                         |
| GET    | `/api/heatmap`             | 取得聚合後的熱點圖資料           |
| GET    | `/api/reports/status`      | Gemini AI 連線狀態               |
| POST   | `/api/reports/generate`    | 根據所選方向與篩選條件產生技術總結（Gemini AI，失敗時 fallback 模板） |

### GitHub 匯入（SRS §2.5.2）

| 方法   | 路徑                         | 說明                          |
| ------ | ---------------------------- | ----------------------------- |
| GET    | `/api/v1/github/login`       | 取得 GitHub OAuth 授權 URL    |
| GET    | `/api/v1/github/callback`    | OAuth callback（後端處理）    |
| GET    | `/api/v1/github/status`      | 連結狀態                      |
| DELETE | `/api/v1/github/disconnect`  | 中斷 GitHub 連結              |
| GET    | `/api/v1/github/repos`       | 列出 public repositories      |
| POST   | `/api/v1/github/import`      | 匯入選定的 repositories       |
| POST   | `/api/v1/github/sync-activity` | 以 GraphQL 同步 commit 活動至 `activity_dates`（可選 `?force=true`） |

## 待辦（後續迭代）

- PDF 匯出（標註為 Won't Have，未來版本）
- 行動裝置響應式（Could Have）
- 核心視覺化邏輯之單元測試（NFR-10）
