import { expect, test } from '@playwright/test'
import {
  fillProjectForm,
  gotoApp,
  navTo,
  selectTag,
  submitModalForm,
  uniqueName,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('smoke: sidebar navigation', async ({ page }) => {
  await gotoApp(page)

  const pages = [
    { link: '儀表板', heading: '儀表板' },
    { link: '專案管理', heading: '專案管理' },
    { link: '標籤管理', heading: '標籤管理' },
    { link: '技術總結', heading: '技術總結' },
  ]

  for (const { link, heading } of pages) {
    await navTo(page, link)
    await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible()
  }
})

test('smoke: create project (PRMS-TC01)', async ({ page }) => {
  const projectName = uniqueName('E2E-Project')

  await gotoApp(page)
  await navTo(page, '專案管理')
  await page.getByRole('button', { name: '+ 新增專案' }).click()

  await fillProjectForm(page, {
    name: projectName,
    description: 'Playwright E2E smoke test project',
    startDate: '2024-01-15',
  })
  await selectTag(page, 'Embedded')
  await submitModalForm(page)

  await expect(page.getByRole('cell', { name: projectName, exact: true })).toBeVisible()
})

test('smoke: edit and delete project (PRMS-TC03~04)', async ({ page }) => {
  const projectName = uniqueName('E2E-Edit')
  const updatedName = `${projectName}-updated`

  await gotoApp(page)
  await navTo(page, '專案管理')
  await page.getByRole('button', { name: '+ 新增專案' }).click()

  await fillProjectForm(page, {
    name: projectName,
    description: 'To be edited and deleted',
    startDate: '2024-02-01',
  })
  await selectTag(page, 'Embedded')
  await submitModalForm(page)
  await expect(page.getByRole('cell', { name: projectName, exact: true })).toBeVisible()

  const row = page.locator('tr', { hasText: projectName })
  await row.getByRole('button', { name: '編輯' }).click()
  await fillProjectForm(page, { name: updatedName, startDate: '2024-02-01' })
  await submitModalForm(page)
  await expect(page.getByRole('cell', { name: updatedName, exact: true })).toBeVisible()

  await page.locator('tr', { hasText: updatedName }).getByRole('button', { name: '刪除' }).click()
  await page.locator('.modal').getByRole('button', { name: '刪除' }).click()
  await expect(page.getByRole('cell', { name: updatedName, exact: true })).toHaveCount(0)
})

test('smoke: dashboard heatmap (TVAS-TC01)', async ({ page }) => {
  await gotoApp(page)
  await navTo(page, '儀表板')

  const cells = page.locator('.heatmap .cell')
  await expect(cells.first()).toBeVisible({ timeout: 30_000 })
  await expect(cells).toHaveCount(await cells.count())
  expect(await cells.count()).toBeGreaterThan(50)
  await expect(page.getByText(/共 \d+ 週/)).toBeVisible()

  const count = await cells.count()
  let hovered = false
  for (let i = 0; i < count; i += 1) {
    const cell = cells.nth(i)
    const cls = await cell.getAttribute('class')
    if (cls && !cls.includes('l0')) {
      await cell.hover()
      await expect(page.locator('.heatmap-tooltip')).toBeVisible()
      await expect(page.locator('.heatmap-tooltip')).toContainText('活動次數')
      await expect(page.locator('.heatmap-tooltip')).toContainText(/· .+/)
      hovered = true
      break
    }
  }
  expect(hovered).toBe(true)
})

test('smoke: generate technical report (TSGS-TC01)', async ({ page }) => {
  await gotoApp(page)
  await navTo(page, '技術總結')

  await page.getByRole('button', { name: '韌體工程師' }).click()
  await page.getByRole('button', { name: '產生技術總結' }).click()

  const preview = page.locator('.md-preview')
  await expect(preview).toBeVisible({ timeout: 30_000 })
  await expect(preview).toContainText('## 概述')
  await expect(preview).toContainText('## 關鍵技術')
})
