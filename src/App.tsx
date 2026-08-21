import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { DiffEditor, type DiffOnMount } from '@monaco-editor/react'
import {
  AlignLeft,
  Braces,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  Code2,
  Copy,
  Eraser,
  Github,
  Hash,
  Minimize2,
  Moon,
  Play,
  Sun,
} from 'lucide-react'

type ToolId = 'json-format' | 'text-diff' | 'timestamp' | 'word-count'
type TimestampUnit = 'ms' | 's'
type Theme = 'dark' | 'light'

const tools: Array<{
  id: ToolId
  label: string
  description: string
  icon: typeof Braces
}> = [
  { id: 'json-format', label: 'JSON 格式化', description: '格式化、压缩与检查 JSON', icon: Braces },
  { id: 'text-diff', label: '文本 Diff', description: '并排比较文本或代码', icon: Code2 },
  { id: 'timestamp', label: '时间戳转换', description: '日期与时间戳双向转换', icon: Clock3 },
  { id: 'word-count', label: '字数统计', description: '实时统计字符与单词', icon: AlignLeft },
]

const toolIds = new Set<ToolId>(tools.map((tool) => tool.id))

function currentToolFromHash(): ToolId {
  const hash = window.location.hash.slice(1) as ToolId
  return toolIds.has(hash) ? hash : 'json-format'
}

function localDateTimeValue(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatLocalDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return '无效日期'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function jsonErrorDetail(raw: string, error: unknown): string {
  const message = error instanceof Error ? error.message : 'JSON 格式错误'
  const position = message.match(/position\s+(\d+)/i)?.[1]
  if (!position) return message
  const offset = Number(position)
  const before = raw.slice(0, offset)
  const line = before.split('\n').length
  const column = offset - before.lastIndexOf('\n')
  return `${message}（第 ${line} 行，第 ${column} 列）`
}

function App() {
  const [activeTool, setActiveTool] = useState<ToolId>(currentToolFromHash)
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  )
  const [toast, setToast] = useState('')

  useEffect(() => {
    const onHashChange = () => setActiveTool(currentToolFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const switchTool = (tool: ToolId) => {
    window.location.hash = tool
    setActiveTool(tool)
  }

  const notify = (message: string) => setToast(message)
  const activeMeta = tools.find((tool) => tool.id === activeTool)!

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ChevronRight size={21} strokeWidth={2.8} /></div>
          <div>
            <div className="brand-name">TextBench</div>
            <div className="brand-tagline">Developer text utilities</div>
          </div>
        </div>

        <nav className="tool-nav" aria-label="工具导航">
          <div className="nav-label">工具</div>
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <button
                className={`nav-item ${activeTool === tool.id ? 'active' : ''}`}
                key={tool.id}
                onClick={() => switchTool(tool.id)}
              >
                <Icon size={18} />
                <span>{tool.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="privacy-note">
            <span className="privacy-dot" />
            数据仅在本地处理
          </div>
          <div className="github-link">
            <Github size={17} /> GitHub Pages Ready
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <h1>{activeMeta.label}</h1>
            <p>{activeMeta.description}</p>
          </div>
          <button
            className="icon-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            title={theme === 'dark' ? '浅色主题' : '深色主题'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <section className="workspace">
          {activeTool === 'json-format' && <JsonFormatter theme={theme} notify={notify} />}
          {activeTool === 'text-diff' && <TextDiff theme={theme} notify={notify} />}
          {activeTool === 'timestamp' && <TimestampConverter notify={notify} />}
          {activeTool === 'word-count' && <WordCounter />}
        </section>
      </main>

      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  )
}

function JsonFormatter({ theme, notify }: { theme: Theme; notify: (message: string) => void }) {
  const [source, setSource] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const transform = (compact: boolean) => {
    if (!source.trim()) {
      setResult('')
      setError('请先在左侧粘贴 JSON')
      return
    }
    try {
      const parsed: unknown = JSON.parse(source)
      setResult(JSON.stringify(parsed, null, compact ? 0 : 2))
      setError('')
      notify(compact ? 'JSON 已压缩' : 'JSON 已格式化')
    } catch (caught) {
      setResult('')
      setError(jsonErrorDetail(source, caught))
    }
  }

  const copy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    notify('结果已复制')
  }

  const clear = () => {
    setSource('')
    setResult('')
    setError('')
  }

  return (
    <div className="tool-layout editor-tool">
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="primary-button" onClick={() => transform(false)}><Play size={15} fill="currentColor" />格式化</button>
          <button className="secondary-button" onClick={() => transform(true)}><Minimize2 size={15} />压缩</button>
        </div>
        <div className="toolbar-group">
          <button className="ghost-button" onClick={copy} disabled={!result}><Copy size={15} />复制结果</button>
          <button className="ghost-button" onClick={clear}><Eraser size={15} />清空</button>
        </div>
      </div>

      <div className="split-editors">
        <EditorPanel title="原始 JSON" badge="INPUT">
          <Editor
            value={source}
            onChange={(value) => setSource(value ?? '')}
            language="json"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={editorOptions(false)}
          />
        </EditorPanel>
        <EditorPanel title="格式化结果" badge="OUTPUT">
          <Editor
            value={result}
            language="json"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={editorOptions(true)}
          />
        </EditorPanel>
      </div>
      {error && <div className="error-banner"><span>!</span>{error}</div>}
    </div>
  )
}

function TextDiff({ theme, notify }: { theme: Theme; notify: (message: string) => void }) {
  const diffRef = useRef<Parameters<DiffOnMount>[0] | null>(null)

  const onMount: DiffOnMount = (editor) => {
    diffRef.current = editor
  }

  const clear = () => {
    diffRef.current?.getOriginalEditor().setValue('')
    diffRef.current?.getModifiedEditor().setValue('')
    notify('内容已清空')
  }

  return (
    <div className="tool-layout editor-tool">
      <div className="toolbar">
        <div className="diff-legend">
          <span><i className="legend-dot removed" />原始文本</span>
          <span><i className="legend-dot added" />修改后文本</span>
        </div>
        <button className="ghost-button" onClick={clear}><Eraser size={15} />清空</button>
      </div>
      <div className="single-editor-frame">
        <div className="diff-headings"><span>原始文本</span><span>修改后文本</span></div>
        <DiffEditor
          original=""
          modified=""
          language="text"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onMount={onMount}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            renderSideBySide: true,
            wordWrap: 'on',
            fontSize: 14,
            lineHeight: 22,
            padding: { top: 14 },
            scrollBeyondLastLine: false,
            originalEditable: true,
          }}
        />
      </div>
    </div>
  )
}

function editorOptions(readOnly: boolean) {
  return {
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineHeight: 22,
    tabSize: 2,
    folding: true,
    showFoldingControls: 'always' as const,
    wordWrap: 'on' as const,
    scrollBeyondLastLine: false,
    padding: { top: 12 },
    readOnly,
    renderValidationDecorations: 'off' as const,
  }
}

function EditorPanel({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="editor-panel">
      <div className="editor-panel-header"><span>{title}</span><small>{badge}</small></div>
      <div className="editor-container">{children}</div>
    </div>
  )
}

function TimestampConverter({ notify }: { notify: (message: string) => void }) {
  const now = new Date()
  const [unit, setUnit] = useState<TimestampUnit>('ms')
  const [timestamp, setTimestamp] = useState(String(now.getTime()))
  const [dateInput, setDateInput] = useState(localDateTimeValue(now))

  const timestampDate = useMemo(() => {
    const value = Number(timestamp.trim())
    if (!timestamp.trim() || !Number.isFinite(value)) return null
    return new Date(unit === 's' ? value * 1000 : value)
  }, [timestamp, unit])

  const dateTimestamp = useMemo(() => {
    const value = new Date(dateInput).getTime()
    if (Number.isNaN(value)) return ''
    return String(unit === 's' ? Math.floor(value / 1000) : value)
  }, [dateInput, unit])

  const copyValue = async (value: string) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    notify('已复制')
  }

  const resetNow = () => {
    const current = new Date()
    setTimestamp(String(unit === 's' ? Math.floor(current.getTime() / 1000) : current.getTime()))
    setDateInput(localDateTimeValue(current))
    notify('已更新为当前时间')
  }

  const changeUnit = (next: TimestampUnit) => {
    if (next === unit) return
    const numeric = Number(timestamp)
    if (Number.isFinite(numeric)) {
      setTimestamp(String(next === 's' ? Math.floor(numeric / 1000) : numeric * 1000))
    }
    setUnit(next)
  }

  return (
    <div className="cards-tool">
      <div className="timestamp-topline">
        <div className="segmented" aria-label="时间戳单位">
          <button className={unit === 's' ? 'active' : ''} onClick={() => changeUnit('s')}>秒 (s)</button>
          <button className={unit === 'ms' ? 'active' : ''} onClick={() => changeUnit('ms')}>毫秒 (ms)</button>
        </div>
        <button className="secondary-button" onClick={resetNow}><Clock3 size={15} />使用当前时间</button>
      </div>

      <div className="converter-grid">
        <article className="converter-card">
          <div className="card-eyebrow"><Hash size={16} />时间戳 → 日期</div>
          <h2>输入时间戳</h2>
          <div className="input-with-unit">
            <input value={timestamp} onChange={(event) => setTimestamp(event.target.value)} inputMode="numeric" />
            <span>{unit}</span>
          </div>
          <div className="result-box">
            <span>本地时间</span>
            <strong>{timestampDate ? formatLocalDate(timestampDate) : '请输入有效时间戳'}</strong>
            <button onClick={() => copyValue(timestampDate ? formatLocalDate(timestampDate) : '')} aria-label="复制日期"><Clipboard size={16} /></button>
          </div>
        </article>

        <article className="converter-card">
          <div className="card-eyebrow"><Clock3 size={16} />日期 → 时间戳</div>
          <h2>选择本地日期与时间</h2>
          <input className="date-input" type="datetime-local" step="1" value={dateInput} onChange={(event) => setDateInput(event.target.value)} />
          <div className="result-box">
            <span>{unit === 's' ? '秒级时间戳' : '毫秒级时间戳'}</span>
            <strong className="mono">{dateTimestamp || '—'}</strong>
            <button onClick={() => copyValue(dateTimestamp)} aria-label="复制时间戳"><Clipboard size={16} /></button>
          </div>
        </article>
      </div>
      <p className="tool-hint">时间依据当前浏览器的本地时区进行转换。</p>
    </div>
  )
}

function WordCounter() {
  const [text, setText] = useState('')
  const stats = useMemo(() => {
    const characters = Array.from(text).length
    const nonWhitespace = Array.from(text).filter((character) => !/\s/u.test(character)).length
    const chinese = text.match(/[\p{Script=Han}]/gu)?.length ?? 0
    const words = text.match(/[\p{Script=Latin}\p{N}]+(?:['’-][\p{Script=Latin}\p{N}]+)*/gu)?.length ?? 0
    const lines = text ? text.split(/\r\n|\r|\n/).length : 0
    return { characters, nonWhitespace, chinese, words, lines }
  }, [text])

  return (
    <div className="counter-tool">
      <div className="stats-grid">
        <StatCard label="总字符数" value={stats.characters} accent />
        <StatCard label="非空字符数" value={stats.nonWhitespace} />
        <StatCard label="汉字数" value={stats.chinese} />
        <StatCard label="单词数" value={stats.words} />
      </div>
      <div className="text-area-card">
        <div className="text-area-head">
          <span>输入文本</span>
          <div><span>{stats.lines} 行</span><button onClick={() => setText('')} disabled={!text}><Eraser size={14} />清空</button></div>
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="在这里输入或粘贴文字，统计结果会实时更新…"
          autoFocus
        />
      </div>
      <p className="tool-hint">总字符数包含文字、标点、空格和换行；非空字符数不包含空白字符。</p>
    </div>
  )
}

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`stat-card ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value.toLocaleString('zh-CN')}</strong></div>
}

export default App
