# PTES — 個人技術棧演進圖譜系統

Personal Tech-Stack Evolution System。本 repo 為 **monorepo**,包含 React SPA 前端與 FastAPI 後端,實作 SRS §2.5 定義的 UI 與 API。

## 目錄結構

```
PTES/
├─ frontend/            # React + Vite SPA（UI，SRS §2.5.1）
│  ├─ src/              #   api/、components/、pages/、context/、hooks/
│  ├─ e2e/              #   Playwright 端對端測試
│  ├─ index.html
│  ├─ vite.config.js
│  └─ package.json
├─ backend/             # FastAPI + SQLModel（SQLite）
│  └─ app/             #   routers/、services/、models、schemas
├─ docker-compose.yml   # 本機開發一鍵啟動
└─ README.md
```

前端與後端透過 Vite proxy 串接:瀏覽器只與前端 `:5173` 同源溝通,`/api` 由 Vite 轉發至後端 `:8000`。

---

## 快速啟動

### 方式一:Docker（推薦,一鍵）

```bash
docker compose up -d
# 前端 http://localhost:5173   後端 http://localhost:8000
```

- 兩個服務皆為**開發模式**:後端 `uvicorn --reload`、前端 `vite dev`,原始碼以 bind mount 掛載,改檔即時生效。
- SQLite 落在 `backend/ptes.db`,經 bind mount 持久化(刪掉容器資料不會掉)。
- 容器內前端的 API proxy 由 `VITE_API_PROXY=http://backend:8000` 指向後端服務(見 `docker-compose.yml`),**不要**改回 `localhost`。
- 停止:`docker compose down`。

### 方式二:原生(各自啟動)

**後端**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # 視需要填入 GitHub OAuth / Gemini 憑證
python -m uvicorn app.main:app --reload --port 8000
```

**前端**

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
npm run build                 # 產生靜態檔
```

DB schema 與種子資料於後端啟動時自動建立(`app/migrate.py`、`app/seed.py`),不需手動 migration。最小視域:1024px(SRS §2.5.1)。

### 在無後端時用 mock 開發

前端預設打真實後端;設定 `VITE_USE_MOCK=true` 可改用記憶體 mock 資料:

```bash
cd frontend && VITE_USE_MOCK=true npm run dev
# Windows PowerShell: $env:VITE_USE_MOCK="true"; npm run dev
```

### 遠端開發:SSH port forwarding

因為瀏覽器只跟前端 `:5173` 溝通(Vite 在伺服器端把 `/api` 轉給後端),**只需轉發 5173 一個 port**:

```bash
ssh -L 5173:localhost:5173 <user>@<host>      # 本機開 http://localhost:5173
```

已在 session 中可用 escape 序列即時加轉發:按 `Enter` → 輸入 `~C` → `-L 5173:localhost:5173`。
想直接看後端 Swagger,再加 `-L 8000:localhost:8000`(`http://localhost:8000/docs`)。

---

## 測試

```bash
cd frontend
npm test            # Vitest 單元測試
npm run test:e2e    # Playwright e2e（會自動以 port 8001/5174 起一套隔離環境）
```

e2e 用獨立的 `backend/e2e.db`,不影響開發資料。

---

## GitHub 整合(SRS §2.5.2)

支援兩種方式查看 GitHub 使用者的 repositories:

| 方式 | 用途 |
|------|------|
| **公開 username 查詢** | 檢視任意 public GitHub 使用者(如 `torvalds`)的 repos,無需 OAuth |
| **OAuth** | 連結「自己的」GitHub 帳號(sidebar「OAuth 連結自己的帳號」) |

### OAuth 設定

1. 至 [GitHub Developer Settings](https://github.com/settings/developers) 建立 **OAuth App**
2. **Authorization callback URL** 設為 `http://localhost:8000/api/v1/github/callback`
3. 將 Client ID / Secret 填入 `backend/.env`:

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:8000/api/v1/github/callback
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./ptes.db
# 可選:提高公開 API 配額（未認證 60 次/hr）
GITHUB_PAT=
```

匯入 repository 時,後端會呼叫 GitHub Languages API,將占比 ≥ 1% 的語言自動對應為標籤(優先比對同名,否則建於「Languages」父標籤下)。同一 profile 下以 `github_repo_id` 判斷,不會重複匯入。

## 多 profile 切換

每位 GitHub 使用者(或本機示範 profile)擁有**獨立的標籤樹、專案、熱點圖與報告**:

- Sidebar 底部「目前使用者」切換 profile(種子含 `本機示範`、`demo-user`、`alice-dev`、`torvalds`)
- 前端所有 CRUD 請求帶 `X-PTES-Profile-Id` header,後端只回該 profile 的資料
- OAuth 完成後 redirect 至 `/projects?github=connected&profile={id}` 並自動切換

## 儀表板 GitHub 活動同步

進入 `/dashboard` 時,若目前 profile 有 GitHub username,後端透過 **GitHub GraphQL `contributionsCollection`** 查詢已匯入 repository 的 commit 貢獻日期,寫入 `activity_dates` 後聚合為熱點圖。

- 範圍:自 `2023-01-01` 起;只統計已匯入 PTES 的 repos
- 節流:同一 profile 30 分鐘內不重複同步(`?force=true` 可跳過)
- 公開 username 模式 GraphQL 配額極低,**強烈建議**設定 `GITHUB_PAT`;OAuth 連結自己的帳號可存取 private repo 貢獻
- 若升級舊版 DB,刪除 `backend/ptes.db` 後重啟以套用新 schema

## Gemini AI 技術總結(US-04)

技術總結頁預設由 **Google Gemini** 依 profile 專案資料產生 Markdown 報告:

1. 至 [Google AI Studio](https://aistudio.google.com/apikey) 取得 API Key
2. 填入 `backend/.env`:

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
```

**Fallback**:未設 key 或 AI 呼叫失敗時,自動改用固定模板產生報告;前端會標示來源(AI / 模板)。建議模型 `gemini-2.5-flash`(免費層可用);遇 429 請改用此型號。

---

## 頁面對照表

| 路由           | 視圖           | 對應使用者故事        |
| -------------- | -------------- | --------------------- |
| `/dashboard`   | 儀表板(熱點圖) | US-03                 |
| `/projects`    | 專案管理       | US-01, US-05, US-06   |
| `/tags`        | 標籤管理       | US-02                 |
| `/reports`     | 技術總結       | US-04                 |

## API 接口

前端後端呼叫集中在 `frontend/src/api/client.js`(GitHub 相關於 `frontend/src/api/github.js`)。

### 核心 REST(SRS §2.5.3)

| 方法   | 路徑                       | 說明                             |
| ------ | -------------------------- | -------------------------------- |
| GET    | `/api/v1/profiles`         | 列出所有 profile(不需 profile header) |
| POST   | `/api/v1/profiles/from-github` | 依 username 建立/更新 profile(公開 API) |
| DELETE | `/api/v1/profiles/{id}`    | 刪除 profile 及其資料            |
| GET    | `/api/v1/projects`         | 取得所有專案(支援查詢參數篩選)  |
| POST   | `/api/v1/projects`         | 建立新的專案紀錄                 |
| GET    | `/api/v1/projects/{id}`    | 依 ID 取得單一專案               |
| PUT    | `/api/v1/projects/{id}`    | 更新現有專案                     |
| DELETE | `/api/v1/projects/{id}`    | 刪除專案                         |
| GET    | `/api/tags`                | 取得完整標籤階層結構             |
| POST   | `/api/tags`                | 建立新標籤                       |
| PUT    | `/api/tags/{id}`           | 更新標籤(重新命名或變更父節點)  |
| DELETE | `/api/tags/{id}`           | 刪除標籤                         |
| GET    | `/api/heatmap`             | 取得聚合後的熱點圖資料           |
| GET    | `/api/reports/status`      | Gemini AI 連線狀態               |
| POST   | `/api/reports/generate`    | 產生技術總結(Gemini,失敗 fallback 模板) |

### GitHub 匯入(SRS §2.5.2)

| 方法   | 路徑                         | 說明                          |
| ------ | ---------------------------- | ----------------------------- |
| GET    | `/api/v1/github/login`       | 取得 GitHub OAuth 授權 URL    |
| GET    | `/api/v1/github/callback`    | OAuth callback(後端處理)     |
| GET    | `/api/v1/github/status`      | 連結狀態                      |
| DELETE | `/api/v1/github/disconnect`  | 中斷 GitHub 連結              |
| GET    | `/api/v1/github/repos`       | 列出 public repositories      |
| POST   | `/api/v1/github/import`      | 匯入選定的 repositories       |
| POST   | `/api/v1/github/sync-activity` | 以 GraphQL 同步 commit 活動(可選 `?force=true`) |

## 待辦(後續迭代)

- PDF 匯出(Won't Have,未來版本)
- 行動裝置響應式(Could Have)
- 核心視覺化邏輯之單元測試(NFR-10)
