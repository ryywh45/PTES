import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Heatmap from './Heatmap'

function makeCells(count) {
  return Array.from({ length: count }, (_, i) => ({
    week_start: `2024-${String(Math.floor(i / 4) + 1).padStart(2, '0')}-${String((i % 4) * 7 + 1).padStart(2, '0')}`,
    week_index: i + 1,
    count: i === count - 1 ? 10 : 0,
    project_ids: i === count - 1 ? [1] : [],
  }))
}

describe('Heatmap', () => {
  it('TVAS-TC01: renders weekly cells and labels', () => {
    const cells = makeCells(52)
    const { container } = render(
      <Heatmap
        cells={cells}
        projects={[{ id: 1, name: 'Demo Project', tag_ids: [1] }]}
        tags={[{ id: 1, name: 'Embedded' }]}
      />,
    )

    expect(container.querySelectorAll('.heatmap .cell')).toHaveLength(52)
    expect(screen.getByText('W1')).toBeInTheDocument()
    expect(screen.getByText('W52')).toBeInTheDocument()
    expect(screen.getByText('共 52 週')).toBeInTheDocument()
  })

  it('TVAS-TC01: applies intensity levels by activity count', () => {
    const cells = [
      { week_start: '2024-01-01', week_index: 1, count: 0, project_ids: [] },
      { week_start: '2024-01-08', week_index: 2, count: 5, project_ids: [1] },
    ]
    const { container } = render(
      <Heatmap cells={cells} projects={[]} tags={[]} />,
    )

    const heatmapCells = container.querySelectorAll('.heatmap .cell')
    expect(heatmapCells[0]).toHaveClass('l0')
    expect(heatmapCells[1]).toHaveClass('l4')
  })

  it('TVAS-TC01: shows project name on hover', () => {
    const cells = [
      { week_start: '2024-01-01', week_index: 1, count: 2, project_ids: [1] },
    ]
    const { container } = render(
      <Heatmap
        cells={cells}
        projects={[{ id: 1, name: 'STM32 Firmware', tag_ids: [1] }]}
        tags={[{ id: 1, name: 'STM32' }]}
      />,
    )

    fireEvent.mouseEnter(container.querySelector('.heatmap .cell'))
    expect(screen.getByText(/STM32 Firmware/)).toBeInTheDocument()
  })
})
