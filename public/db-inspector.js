import { database } from './firebase-config.js'
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js'

const rootKeys = ['admins','barbers','bookings','clients','products','promotions','storeSettings']

const sections = document.getElementById('sections')

function createSection(title) {
  const el = document.createElement('section')
  el.className = 'inspector-section'
  el.innerHTML = `
    <h2>${title}</h2>
    <div class="inspector-actions">
      <input placeholder="Pesquisar..." class="search-input" />
      <select class="status-filter" style="display:none;"></select>
      <label><input type="checkbox" class="toggle-json" /> JSON</label>
      <div style="margin-left:auto" class="count"></div>
    </div>
    <div class="table-wrap"></div>
  `
  sections.appendChild(el)
  return el
}

function renderTable(container, itemsArray) {
  const tableWrap = container.querySelector('.table-wrap')
  tableWrap.innerHTML = ''
  if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
    tableWrap.innerHTML = '<div class="inspector-count">Sem registos</div>'
    return
  }

  // determine columns
  const columns = new Set()
  itemsArray.forEach(i => Object.keys(i).forEach(k => columns.add(k)))
  const cols = ['id', ...Array.from(columns)]

  const table = document.createElement('table')
  table.className = 'inspector-table'
  const thead = document.createElement('thead')
  thead.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>'
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  itemsArray.forEach(row => {
    const tr = document.createElement('tr')
    cols.forEach(c => {
      const td = document.createElement('td')
      let value = row[c]
      if (value === undefined) value = ''
      else if (typeof value === 'object') value = JSON.stringify(value)
      td.textContent = value
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  tableWrap.appendChild(table)
}

function attachControls(sectionEl, rawData) {
  const search = sectionEl.querySelector('.search-input')
  const statusSelect = sectionEl.querySelector('.status-filter')
  const toggleJson = sectionEl.querySelector('.toggle-json')
  const countEl = sectionEl.querySelector('.count')

  // flatten data: {id: obj} -> [{id, ...obj}]
  const items = []
  if (!rawData) {
    renderTable(sectionEl, [])
    countEl.textContent = ''
    return
  }
  if (typeof rawData === 'object' && !Array.isArray(rawData)) {
    for (const k of Object.keys(rawData)) {
      const obj = rawData[k]
      if (obj && typeof obj === 'object') items.push({ id: k, ...obj })
      else items.push({ id: k, value: obj })
    }
  } else if (Array.isArray(rawData)) {
    rawData.forEach((v, i) => items.push({ id: i, ...v }))
  }

  countEl.textContent = `${items.length} registos`

  // dynamic status filter detection
  const statusFields = ['lifecycle','status','state','executionStatus','lifecycleStatus']
  let detectedField = null
  for (const f of statusFields) {
    if (items.some(it => it[f] !== undefined)) { detectedField = f; break }
  }
  if (detectedField) {
    statusSelect.style.display = ''
    const values = Array.from(new Set(items.map(it => it[detectedField]).filter(Boolean)))
    statusSelect.innerHTML = '<option value="">--filtrar estado--</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('')
  } else {
    statusSelect.style.display = 'none'
  }

  function applyFilters() {
    const q = search.value.trim().toLowerCase()
    const statusVal = statusSelect.value
    const filtered = items.filter(it => {
      if (statusVal && String(it[detectedField]) !== statusVal) return false
      if (!q) return true
      return JSON.stringify(it).toLowerCase().includes(q)
    })
    renderTable(sectionEl, filtered)
  }

  search.addEventListener('input', () => applyFilters())
  statusSelect.addEventListener('change', () => applyFilters())
  toggleJson.addEventListener('change', (e) => {
    const tableWrap = sectionEl.querySelector('.table-wrap')
    if (e.target.checked) {
      tableWrap.innerHTML = `<div class="json-view">${JSON.stringify(rawData, null, 2)}</div>`
    } else {
      applyFilters()
    }
  })

  // initial render
  applyFilters()
}

function mountNode(path) {
  const el = createSection(path)
  const dbRef = ref(database, path)
  onValue(dbRef, snap => {
    const val = snap.val()
    attachControls(el, val)
  })
}

// create sections
rootKeys.forEach(k => mountNode(k))
