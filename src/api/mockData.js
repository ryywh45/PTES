// Mock data for prototype. Mirrors backend payload shapes so swapping to real
// API only requires flipping the USE_MOCK flag in client.js.

export const mockTags = [
  { id: 1, name: 'Embedded', parent_id: null },
  { id: 2, name: 'STM32', parent_id: 1 },
  { id: 3, name: 'HAL', parent_id: 2 },
  { id: 4, name: 'FreeRTOS', parent_id: 1 },
  { id: 5, name: 'MQTT', parent_id: 1 },
  { id: 6, name: 'Backend', parent_id: null },
  { id: 7, name: 'Python', parent_id: 6 },
  { id: 8, name: 'FastAPI', parent_id: 7 },
  { id: 9, name: 'Node.js', parent_id: 6 },
  { id: 10, name: 'Spring', parent_id: 6 },
  { id: 11, name: 'Database', parent_id: 6 },
  { id: 12, name: 'REST API', parent_id: 6 },
  { id: 13, name: 'Frontend', parent_id: null },
  { id: 14, name: 'React', parent_id: 13 },
  { id: 15, name: 'D3.js', parent_id: 13 },
]

// Reproducible PRNG so the heatmap is deterministic across reloads.
function lcg(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function synthActivity(seed, start, end, weight) {
  const startD = new Date(start)
  const endD = end ? new Date(end) : new Date('2026-05-03')
  const totalDays = Math.max(7, Math.round((endD - startD) / 86400000))
  const numEvents = Math.max(8, Math.floor(totalDays * 0.18 * weight))
  const rand = lcg(seed)
  const dates = new Set()
  for (let i = 0; i < numEvents; i++) {
    // Bias toward the middle of the project window with two-sample averaging.
    const offset = Math.floor(((rand() + rand()) / 2) * totalDays)
    const d = new Date(startD.getTime() + offset * 86400000)
    dates.add(d.toISOString().slice(0, 10))
  }
  return [...dates].sort()
}

const baseProjects = [
  // ===== 2023 =====
  {
    name: 'Embedded Final Project',
    description: 'STM32 期末實作，整合 HAL 驅動、UART 與多顆感測器',
    start: '2023-03-10', end: '2023-06-25',
    tag_ids: [1, 2, 3], weight: 1.2,
  },
  {
    name: 'IoT Weather Station',
    description: '基於 STM32 + FreeRTOS 的天氣監控站，透過 MQTT 上傳資料',
    start: '2023-04-15', end: '2023-09-20',
    tag_ids: [1, 2, 4, 5], weight: 1.0,
  },
  {
    name: 'Python REST API Lab',
    description: 'FastAPI 課程實驗，CRUD + JWT 驗證 + 自動文件',
    start: '2023-09-05', end: '2023-12-15',
    tag_ids: [6, 7, 8, 12], weight: 0.9,
  },
  {
    name: 'Data Pipeline Demo',
    description: 'ETL 範例，搭配 PostgreSQL 與排程器',
    start: '2023-10-20', end: '2024-01-10',
    tag_ids: [6, 11], weight: 0.7,
  },

  // ===== 2024 =====
  {
    name: 'Spring Microservice Suite',
    description: '訂單／庫存微服務拆分，整合 REST 與資料庫',
    start: '2024-01-20', end: '2024-05-30',
    tag_ids: [6, 10, 11, 12], weight: 1.4,
  },
  {
    name: 'Drone Flight Controller',
    description: 'STM32 + FreeRTOS 飛控韌體，PID 控制與遙控通訊',
    start: '2024-03-01', end: '2024-08-25',
    tag_ids: [1, 2, 4], weight: 1.3,
  },
  {
    name: 'React Admin Dashboard',
    description: 'React + 資料表格 + 角色權限的後台介面',
    start: '2024-05-10', end: '2024-09-30',
    tag_ids: [13, 14], weight: 1.0,
  },
  {
    name: 'Node.js IoT Gateway',
    description: 'Node 邊緣閘道，串接 MQTT 與 REST 後端',
    start: '2024-07-05', end: '2024-12-20',
    tag_ids: [1, 5, 6, 9, 12], weight: 1.1,
  },
  {
    name: 'D3 Visualization Library',
    description: '自製 D3 圖表元件庫，支援互動與動畫',
    start: '2024-09-15', end: '2024-12-30',
    tag_ids: [13, 15], weight: 0.9,
  },
  {
    name: 'DB Migration Tooling',
    description: '資料庫遷移腳本與多環境管控',
    start: '2024-11-01', end: '2025-01-20',
    tag_ids: [6, 11], weight: 0.7,
  },

  // ===== 2025 =====
  {
    name: 'Web Tools Portal',
    description: 'React 內部工具站，整合 D3 圖表與儀表板',
    start: '2025-01-15', end: '2025-04-30',
    tag_ids: [13, 14, 15], weight: 0.9,
  },
  {
    name: 'Frontend Refactor',
    description: '舊系統 UI 改寫為 React SPA，導入元件化設計',
    start: '2025-03-10', end: '2025-07-15',
    tag_ids: [13, 14], weight: 1.0,
  },
  {
    name: 'Order Service v2',
    description: 'Spring Boot 微服務搭配 MySQL，提供完整 REST API',
    start: '2025-05-01', end: '2025-08-31',
    tag_ids: [6, 10, 11, 12], weight: 1.4,
  },
  {
    name: 'Analytics Service',
    description: 'Python 分析後端，彙總業務指標並輸出報表',
    start: '2025-07-01', end: '2025-11-30',
    tag_ids: [6, 7, 11], weight: 1.1,
  },
  {
    name: 'CI Pipeline Refresh',
    description: '改善建置與部署流程，加入靜態分析與整合測試',
    start: '2025-08-15', end: '2025-10-30',
    tag_ids: [6, 7], weight: 0.7,
  },
  {
    name: 'Smart Sensor Hub',
    description: 'STM32 韌體整合 FreeRTOS 與 MQTT 上傳遙測資料至雲端',
    start: '2025-09-12', end: '2026-01-20',
    tag_ids: [1, 2, 3, 4, 5], weight: 1.6,
  },
  {
    name: 'IoT Gateway 2.0',
    description: 'Node.js 邊緣閘道升級版，整合 MQTT 與 REST',
    start: '2025-11-05', end: '2026-02-15',
    tag_ids: [1, 5, 6, 9, 12], weight: 1.2,
  },

  // ===== 2026 =====
  {
    name: 'Mobile Companion App',
    description: 'React Native 行動端輔助工具',
    start: '2026-01-15', end: null,
    tag_ids: [13, 14], weight: 1.0,
  },
  {
    name: 'PTES Backend',
    description: '以 FastAPI + SQLite 建立個人技術棧紀錄 API',
    start: '2026-02-01', end: null,
    tag_ids: [6, 7, 8, 11, 12], weight: 1.5,
  },
  {
    name: 'Edge ML Demo',
    description: '在 STM32 上跑 TFLite Micro，邊緣端推論',
    start: '2026-02-20', end: null,
    tag_ids: [1, 2], weight: 0.9,
  },
  {
    name: 'Tech Heatmap UI',
    description: 'React SPA 視覺化技能熱點圖與標籤樹',
    start: '2026-03-10', end: null,
    tag_ids: [13, 14, 15], weight: 1.4,
  },
]

export const mockProjects = baseProjects.map((p, i) => {
  const seed = 1000 + i * 137
  const today = new Date('2026-05-03')
  const created = `${p.start}T08:00:00Z`
  const updated = (p.end || today.toISOString().slice(0, 10)) + 'T17:00:00Z'
  return {
    id: i + 1,
    name: p.name,
    description: p.description,
    start_date: p.start,
    end_date: p.end,
    tag_ids: p.tag_ids,
    created_at: created,
    updated_at: updated,
    activity_dates: synthActivity(seed, p.start, p.end, p.weight),
  }
})

export const careerDirections = [
  {
    id: 'firmware',
    label: '韌體工程師',
    tags: ['STM32', 'FreeRTOS', 'MQTT', 'Embedded'],
  },
  {
    id: 'backend',
    label: '後端軟體架構師',
    tags: ['Node.js', 'Spring', 'Database', 'REST API'],
  },
  {
    id: 'frontend',
    label: '前端工程師',
    tags: ['React', 'D3.js', 'Frontend'],
  },
]

// Snap a date to the Monday of its ISO week.
export function startOfWeek(d) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

// Build heatmap cells for a [from, to] window. Each cell aggregates one ISO week
// (Mon~Sun). Counts come from each project's activity_dates.
export function buildHeatmap(projects, fromDate, toDate) {
  const from = startOfWeek(fromDate)
  const to = new Date(toDate)
  to.setHours(23, 59, 59, 999)
  const cells = []

  // Pre-index activity dates → project ids for O(1) lookup.
  const dateIndex = new Map()
  for (const p of projects) {
    for (const d of p.activity_dates || []) {
      const arr = dateIndex.get(d) || []
      arr.push(p.id)
      dateIndex.set(d, arr)
    }
  }

  let weekIndex = 1
  for (let cur = new Date(from); cur <= to; cur.setDate(cur.getDate() + 7)) {
    const weekStart = new Date(cur)
    let count = 0
    const projectIds = new Set()
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(day.getDate() + i)
      const key = day.toISOString().slice(0, 10)
      const hits = dateIndex.get(key)
      if (hits) {
        count += hits.length
        for (const id of hits) projectIds.add(id)
      }
    }
    cells.push({
      week_start: weekStart.toISOString().slice(0, 10),
      week_index: weekIndex,
      count,
      project_ids: [...projectIds],
    })
    weekIndex++
  }
  return cells
}
