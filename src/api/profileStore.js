let profileIdGetter = () => {
  const stored = localStorage.getItem('ptes_active_profile_id')
  return stored ? Number(stored) : null
}

export function setProfileIdGetter(fn) {
  profileIdGetter = fn
}

export function getProfileId() {
  return profileIdGetter()
}

export const mockProfilesList = [
  {
    id: 1,
    github_login: null,
    display_name: '本機示範',
    avatar_url: null,
    has_token: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    github_login: 'demo-user',
    display_name: 'demo-user',
    avatar_url: null,
    has_token: true,
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 3,
    github_login: 'alice-dev',
    display_name: 'alice-dev',
    avatar_url: null,
    has_token: false,
    created_at: '2026-01-03T00:00:00Z',
  },
  {
    id: 4,
    github_login: 'torvalds',
    display_name: 'Linus Torvalds',
    avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
    has_token: false,
    created_at: '2026-01-04T00:00:00Z',
  },
]

/** @deprecated use mockProfilesList */
export const MOCK_PROFILES = mockProfilesList

export function buildMockTagsForProfile(profileId) {
  if (profileId === 2) {
    return [
      { id: 201, profile_id: 2, name: 'Frontend', parent_id: null },
      { id: 202, profile_id: 2, name: 'React', parent_id: 201 },
      { id: 203, profile_id: 2, name: 'Backend', parent_id: null },
      { id: 204, profile_id: 2, name: 'FastAPI', parent_id: 203 },
    ]
  }
  if (profileId === 3) {
    return [
      { id: 301, profile_id: 3, name: 'Embedded', parent_id: null },
      { id: 302, profile_id: 3, name: 'STM32', parent_id: 301 },
      { id: 303, profile_id: 3, name: 'MQTT', parent_id: 301 },
    ]
  }
  if (profileId === 4) {
    return [{ id: 401, profile_id: 4, name: 'GitHub', parent_id: null }]
  }
  return [
    { id: 1, profile_id: 1, name: 'Embedded', parent_id: null },
    { id: 2, profile_id: 1, name: 'STM32', parent_id: 1 },
    { id: 3, profile_id: 1, name: 'HAL', parent_id: 2 },
    { id: 4, profile_id: 1, name: 'FreeRTOS', parent_id: 1 },
    { id: 5, profile_id: 1, name: 'MQTT', parent_id: 1 },
    { id: 6, profile_id: 1, name: 'Backend', parent_id: null },
    { id: 7, profile_id: 1, name: 'Python', parent_id: 6 },
    { id: 8, profile_id: 1, name: 'FastAPI', parent_id: 7 },
    { id: 9, profile_id: 1, name: 'Node.js', parent_id: 6 },
    { id: 10, profile_id: 1, name: 'Spring', parent_id: 6 },
    { id: 11, profile_id: 1, name: 'Database', parent_id: 6 },
    { id: 12, profile_id: 1, name: 'REST API', parent_id: 6 },
    { id: 13, profile_id: 1, name: 'Frontend', parent_id: null },
    { id: 14, profile_id: 1, name: 'React', parent_id: 13 },
    { id: 15, profile_id: 1, name: 'D3.js', parent_id: 13 },
  ]
}

export function buildMockProjectsForProfile(profileId) {
  if (profileId === 2) {
    return [
      {
        id: 2001,
        profile_id: 2,
        name: 'PTES Demo App',
        description: 'React demo for PTES',
        start_date: '2025-06-01',
        end_date: null,
        tag_ids: [201, 202],
        created_at: '2025-06-01T08:00:00Z',
        updated_at: '2026-01-10T17:00:00Z',
        activity_dates: ['2025-06-01', '2026-01-10'],
      },
    ]
  }
  if (profileId === 3) {
    return [
      {
        id: 3001,
        profile_id: 3,
        name: 'Sensor Firmware',
        description: 'STM32 sensor node with MQTT',
        start_date: '2024-08-01',
        end_date: '2025-02-01',
        tag_ids: [301, 302, 303],
        created_at: '2024-08-01T08:00:00Z',
        updated_at: '2025-02-01T17:00:00Z',
        activity_dates: ['2024-08-01', '2025-02-01'],
      },
    ]
  }
  if (profileId === 4) {
    return []
  }
  return [
    {
      id: 1,
      profile_id: 1,
      name: 'Embedded Final Project',
      description: 'STM32 期末實作，整合 HAL 驅動、UART 與多顆感測器',
      start_date: '2023-03-10',
      end_date: '2023-06-25',
      tag_ids: [1, 2, 3],
      created_at: '2023-03-10T08:00:00Z',
      updated_at: '2023-06-25T17:00:00Z',
      activity_dates: ['2023-03-10', '2023-04-01', '2023-05-15'],
    },
    {
      id: 2,
      profile_id: 1,
      name: 'PTES Backend',
      description: '以 FastAPI + SQLite 建立個人技術棧紀錄 API',
      start_date: '2026-02-01',
      end_date: null,
      tag_ids: [6, 7, 8, 11, 12],
      created_at: '2026-02-01T08:00:00Z',
      updated_at: '2026-05-03T17:00:00Z',
      activity_dates: ['2026-02-01', '2026-03-15', '2026-05-03'],
    },
    {
      id: 3,
      profile_id: 1,
      name: 'Tech Heatmap UI',
      description: 'React SPA 視覺化技能熱點圖與標籤樹',
      start_date: '2026-03-10',
      end_date: null,
      tag_ids: [13, 14, 15],
      created_at: '2026-03-10T08:00:00Z',
      updated_at: '2026-05-03T17:00:00Z',
      activity_dates: ['2026-03-10', '2026-04-20'],
    },
  ]
}
