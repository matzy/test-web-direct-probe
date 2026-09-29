const DEVICE_ORIGIN = 'http://192.168.7.1'
const REQUEST_TIMEOUT_MS = 5000

const elements = {
  secureBadge: document.querySelector('#secure-badge'),
  pageOrigin: document.querySelector('#page-origin'),
  browserInfo: document.querySelector('#browser-info'),
  runTime: document.querySelector('#run-time'),
  getButton: document.querySelector('#get-button'),
  getResult: document.querySelector('#get-result'),
  postConfirm: document.querySelector('#post-confirm'),
  postButton: document.querySelector('#post-button'),
  postResult: document.querySelector('#post-result'),
  clearButton: document.querySelector('#clear-button'),
  logList: document.querySelector('#log-list'),
}

let activeRequests = 0

function browserLabel() {
  const ua = navigator.userAgent
  const match = ua.match(/Edg\/([\d.]+)/) ?? ua.match(/Chrome\/([\d.]+)/) ?? ua.match(/Firefox\/([\d.]+)/)
  return match ? `${match[0].startsWith('Edg/') ? 'Edge' : match[0].startsWith('Chrome/') ? 'Chrome' : 'Firefox'} ${match[1]}` : ua
}

function addLog(message, detail = '') {
  const empty = elements.logList.querySelector('.log-empty')
  if (empty) empty.remove()

  const item = document.createElement('li')
  const timestamp = new Date().toLocaleTimeString()
  item.textContent = `[${timestamp}] ${message}${detail ? ` — ${detail}` : ''}`
  elements.logList.prepend(item)
}

function setResult(element, status, detail) {
  element.textContent = `${status}: ${detail}`
  element.dataset.state = status === '成功' ? 'success' : status === '実行中' ? 'pending' : 'error'
}

function updateOriginStatus() {
  elements.pageOrigin.textContent = window.location.origin
  elements.browserInfo.textContent = browserLabel()

  const isHttps = window.location.protocol === 'https:'
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  if (isHttps && !isLocalhost) {
    elements.secureBadge.textContent = 'HTTPS オリジン'
    elements.secureBadge.dataset.state = 'success'
  } else {
    elements.secureBadge.textContent = isHttps ? 'localhost · 本番判定不可' : 'HTTPS ではありません'
    elements.secureBadge.dataset.state = 'warning'
  }
}

async function requestJson(path, init = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const startedAt = performance.now()
  try {
    const response = await fetch(`${DEVICE_ORIGIN}${path}`, {
      ...init,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    const elapsed = Math.round(performance.now() - startedAt)
    const text = await response.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error(`HTTP ${response.status}; 応答が JSON ではありません (${text.length} bytes, ${elapsed} ms)`)
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} (${elapsed} ms)`)
    return { body, elapsed, status: response.status }
  } finally {
    window.clearTimeout(timeout)
  }
}

async function runRequest({ button, output, label, path, init, summarize }) {
  if (activeRequests > 0) return
  activeRequests += 1
  button.disabled = true
  setResult(output, '実行中', 'ブラウザーから機器へ直接接続しています')
  elements.runTime.textContent = new Date().toLocaleString()
  addLog(`${label} 開始`, `${path} · ${window.location.origin}`)

  try {
    const { body, elapsed, status } = await requestJson(path, init)
    if (typeof body?.error === 'string') {
      throw new Error(`HTTP ${status}; API error: ${body.error}`)
    }
    const summary = summarize(body)
    setResult(output, '成功', `${summary} (HTTP ${status}, ${elapsed} ms)`)
    addLog(`${label} 成功`, `HTTP ${status}, ${elapsed} ms, ${summary}`)
  } catch (error) {
    const detail = error instanceof Error
      ? error.name === 'AbortError' ? `タイムアウト (${REQUEST_TIMEOUT_MS} ms)` : error.message
      : String(error)
    const diagnostic = error instanceof Error && error.name === 'AbortError'
      ? detail
      : `ブラウザーから応答を読めませんでした (${detail})`
    setResult(output, '失敗', diagnostic)
    addLog(`${label} 失敗`, `${diagnostic} · Console / Network を確認`)
    console.warn(`[Web Direct Probe] ${label} failed`, error)
  } finally {
    activeRequests -= 1
    button.disabled = false
    elements.postButton.disabled = activeRequests > 0 || !elements.postConfirm.checked
  }
}

elements.getButton.addEventListener('click', () => {
  void runRequest({
    button: elements.getButton,
    output: elements.getResult,
    label: 'Firmware GET',
    path: '/api/getFirmwareVersion',
    init: { method: 'GET' },
    summarize: (body) => `Firmware ${String(body.version ?? 'version 不明')}`,
  })
})

elements.postConfirm.addEventListener('change', () => {
  elements.postButton.disabled = activeRequests > 0 || !elements.postConfirm.checked
})

elements.postButton.addEventListener('click', () => {
  if (!elements.postConfirm.checked) return
  void runRequest({
    button: elements.postButton,
    output: elements.postResult,
    label: 'Hall voltage JSON POST',
    path: '/api/getHETriggerVoltage',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: 0 }),
    },
    summarize: (body) => typeof body.voltage === 'number'
      ? `電圧読み取り ${body.voltage}`
      : `API 応答: ${String(body.error ?? 'voltage 不明')}`,
  })
})

elements.clearButton.addEventListener('click', () => {
  elements.logList.replaceChildren()
  const empty = document.createElement('li')
  empty.className = 'log-empty'
  empty.textContent = 'テストを実行すると結果が表示されます。'
  elements.logList.append(empty)
})

updateOriginStatus()
