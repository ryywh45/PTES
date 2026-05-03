import { useState } from 'react'
import TagPicker from './TagPicker'

// US-01 AC-1..AC-3 + US-05 AC-1: shared form for create/edit. Validation runs
// client-side; the same rules will be enforced server-side per NFR-04.
export default function ProjectForm({ tags, initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [start_date, setStartDate] = useState(initial?.start_date || '')
  const [end_date, setEndDate] = useState(initial?.end_date || '')
  const [tag_ids, setTagIds] = useState(initial?.tag_ids || [])
  const [errs, setErrs] = useState({})
  const [saving, setSaving] = useState(false)

  function validate() {
    const e = {}
    if (!name.trim()) e.name = '專案名稱為必填'
    else if (name.length > 200) e.name = '名稱不可超過 200 字元'
    if (description && description.length > 1000)
      e.description = '描述不可超過 1000 字元'
    if (!start_date) e.start_date = '開始日期為必填'
    if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(start_date))
      e.start_date = '格式須為 YYYY-MM-DD'
    if (end_date && end_date < start_date)
      e.end_date = '結束日期不得早於開始日期'
    if (tag_ids.length === 0) e.tag_ids = '請至少選擇 1 個標籤'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    setErrs(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        start_date,
        end_date: end_date || null,
        tag_ids,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>專案名稱 <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={250}
          style={{ width: '100%' }}
          autoFocus
        />
        <div className="help">1~200 字元</div>
        {errs.name && <div className="err">{errs.name}</div>}
      </div>

      <div className="field">
        <label>描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1100}
          style={{ width: '100%' }}
        />
        <div className="help">最多 1000 字元（{description.length}/1000）</div>
        {errs.description && <div className="err">{errs.description}</div>}
      </div>

      <div className="row" style={{ gap: 16 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>開始日期 <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            type="date"
            value={start_date}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: '100%' }}
          />
          {errs.start_date && <div className="err">{errs.start_date}</div>}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>結束日期</label>
          <input
            type="date"
            value={end_date}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: '100%' }}
          />
          <div className="help">留空表示進行中</div>
          {errs.end_date && <div className="err">{errs.end_date}</div>}
        </div>
      </div>

      <div className="field">
        <label>關聯標籤 <span style={{ color: 'var(--danger)' }}>*</span></label>
        <TagPicker
          tags={tags}
          value={tag_ids}
          onChange={setTagIds}
          placeholder="從階層中挑選一或多個技術標籤"
        />
        {errs.tag_ids && <div className="err">{errs.tag_ids}</div>}
      </div>

      <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={saving}>取消</button>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? '儲存中…' : initial ? '更新' : '建立'}
        </button>
      </div>
    </form>
  )
}
