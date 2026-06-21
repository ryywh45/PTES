import { expect, type Page } from '@playwright/test'

export function uniqueName(prefix: string) {
  return `${prefix}-${Date.now()}`
}

export async function gotoApp(page: Page) {
  await page.goto('/')
  await page.waitForSelector('.profile-gate', { state: 'detached', timeout: 30_000 })
  await expect(page.getByRole('heading', { name: '儀表板' })).toBeVisible()
}

export async function navTo(page: Page, label: string) {
  await page.getByRole('link', { name: label }).click()
}

export async function selectTag(page: Page, tagName: string) {
  const modal = page.locator('.modal')
  const picker = modal.locator('div[style*="cursor: pointer"]').first()
  await picker.click()
  await modal.getByRole('checkbox', { name: tagName, exact: true }).check()
  await picker.click()
  await expect(modal.locator('div[style*="position: absolute"]').first()).toBeHidden()
}

export async function submitModalForm(page: Page) {
  await page.locator('.modal form').evaluate((form) => {
    form.requestSubmit()
  })
  await expect(page.locator('.modal')).toHaveCount(0, { timeout: 10_000 })
}

export async function fillProjectForm(
  page: Page,
  opts: { name: string; description?: string; startDate: string },
) {
  const modal = page.locator('.modal, [class*="modal"]').filter({ hasText: '專案' }).first()
  const scope = (await modal.count()) > 0 ? modal : page

  await scope.locator('input[type="text"]').first().fill(opts.name)
  if (opts.description) {
    await scope.locator('textarea').fill(opts.description)
  }
  await scope.locator('input[type="date"]').first().fill(opts.startDate)
}
