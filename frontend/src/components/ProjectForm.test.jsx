import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProjectForm from './ProjectForm'

const tags = [
  { id: 1, name: 'Embedded', parent_id: null },
  { id: 2, name: 'STM32', parent_id: 1 },
]

function getNameInput(container) {
  return container.querySelector('input[type="text"]')
}

function getStartDateInput(container) {
  return container.querySelector('input[type="date"]')
}

describe('ProjectForm', () => {
  it('PRMS-TC02: rejects names longer than 200 characters', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <ProjectForm
        tags={tags}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )

    fireEvent.change(getNameInput(container), {
      target: { value: 'x'.repeat(201) },
    })
    fireEvent.change(getStartDateInput(container), {
      target: { value: '2024-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: '建立' }))

    expect(screen.getByText('名稱不可超過 200 字元')).toBeInTheDocument()
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled())
  })

  it('PRMS-TC02: requires start date and at least one tag', async () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <ProjectForm
        tags={tags}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )

    fireEvent.change(getNameInput(container), {
      target: { value: 'Valid Name' },
    })
    fireEvent.click(screen.getByRole('button', { name: '建立' }))

    expect(screen.getByText('開始日期為必填')).toBeInTheDocument()
    expect(screen.getByText('請至少選擇 1 個標籤')).toBeInTheDocument()
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled())
  })
})
