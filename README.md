# PTES Frontend (Prototype v0.1)

React SPA prototype of the **個人技術棧演進圖譜系統 (Personal Tech-Stack Evolution System)**, implementing the UI surface defined in SRS §2.5.1.

## 啟動

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 產生靜態檔
```

最小視域：1024px（依 SRS §2.5.1）。

## 頁面對照表

| 路由           | 視圖           | 對應使用者故事         |
| -------------- | -------------- | ---------------------- |
| `/dashboard`   | 儀表板（熱點圖）| US-03                  |
| `/projects`    | 專案管理        | US-01, US-05, US-06   |
| `/tags`        | 標籤管理        | US-02                  |
| `/reports`     | 技術總結        | US-04                  |

## API 接口

所有後端呼叫集中在 `src/api/client.js`。檔案頂部的 `USE_MOCK = true` 旗標控制資料來源：

- `true`（目前）：以記憶體 mock data 模擬全部 CRUD（資料來自 `src/api/mockData.js`）
- `false`：透過 `vite.config.js` 的 proxy 呼叫 `http://localhost:8000` 上的 FastAPI 後端

對應 SRS §2.5.3 的端點：

| 方法   | 路徑                       | 說明                             |
| ------ | -------------------------- | -------------------------------- |
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
| POST   | `/api/reports/generate`    | 根據所選方向與篩選條件產生技術總結 |

## 待辦（後續迭代）

- 接入真實 FastAPI 後端 → 切換 `USE_MOCK = false`
- GitHub API OAuth 匯入（SRS §2.5.2）
- PDF 匯出（標註為 Won't Have，未來版本）
- 行動裝置響應式（Could Have）
- 核心視覺化邏輯之單元測試（NFR-10）
