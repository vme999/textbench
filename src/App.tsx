import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { DiffEditor, type DiffOnMount, type OnMount } from '@monaco-editor/react'
import {
  AlignLeft,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Clipboard,
  Clock3,
  Code2,
  Copy,
  Eraser,
  Hash,
  Minimize2,
  Moon,
  Play,
  Search,
  Sun,
} from 'lucide-react'

type ToolId = 'json-format' | 'text-diff' | 'url-codec' | 'timestamp' | 'word-count'
type TimestampUnit = 'ms' | 's'
type Theme = 'dark' | 'light'
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type JsonViewMode = 'tree' | 'text'
type MonacoEditor = Parameters<OnMount>[0]

const tools: Array<{
  id: ToolId
  label: string
  description: string
  icon: typeof Braces
}> = [
  { id: 'json-format', label: 'JSON Formatter', description: 'Format, minify, and validate JSON', icon: Braces },
  { id: 'text-diff', label: 'Text Diff', description: 'Compare text or code side by side', icon: Code2 },
  { id: 'url-codec', label: 'URL Encoder / Decoder', description: 'Encode or decode URLs and URL components', icon: Hash },
  { id: 'timestamp', label: 'Timestamp Converter', description: 'Convert between dates and timestamps', icon: Clock3 },
  { id: 'word-count', label: 'Text Counter', description: 'Count characters and words in real time', icon: AlignLeft },
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
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-US', {
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
  const message = error instanceof Error ? error.message : 'Invalid JSON'
  const position = message.match(/position\s+(\d+)/i)?.[1]
  if (!position) return message
  const offset = Number(position)
  const before = raw.slice(0, offset)
  const line = before.split('\n').length
  const column = offset - before.lastIndexOf('\n')
  return `${message} (line ${line}, column ${column})`
}

function openEditorSearch(editor: MonacoEditor | null) {
  if (!editor) return
  editor.focus()
  void editor.getAction('actions.find')?.run()
}

function App() {
  const [activeTool, setActiveTool] = useState<ToolId>(currentToolFromHash)
  const [theme, setTheme] = useState<Theme>('light')
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

        <nav className="tool-nav" aria-label="Tool navigation">
          <div className="nav-label">Tools</div>
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
            Data stays in your browser
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
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <section className="workspace">
          {activeTool === 'json-format' && <JsonFormatter theme={theme} notify={notify} />}
          {activeTool === 'text-diff' && <TextDiff theme={theme} notify={notify} />}
          {activeTool === 'url-codec' && <UrlCodec notify={notify} />}
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
  const [parsed, setParsed] = useState<JsonValue | undefined>()
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<JsonViewMode>('tree')
  const [treeState, setTreeState] = useState({ revision: 0, expanded: true })
  const sourceEditorRef = useRef<MonacoEditor | null>(null)
  const resultEditorRef = useRef<MonacoEditor | null>(null)
  const pendingResultSearch = useRef(false)

  const transform = (compact: boolean) => {
    if (!source.trim()) {
      setResult('')
      setError('Paste JSON into the left editor first')
      return
    }
    try {
      const nextValue = JSON.parse(source) as JsonValue
      setParsed(nextValue)
      setResult(JSON.stringify(nextValue, null, compact ? 0 : 2))
      setViewMode(compact ? 'text' : 'tree')
      setTreeState((state) => ({ revision: state.revision + 1, expanded: true }))
      setError('')
      notify(compact ? 'JSON minified' : 'JSON formatted')
    } catch (caught) {
      setResult('')
      setParsed(undefined)
      setError(jsonErrorDetail(source, caught))
    }
  }

  const copy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    notify('Result copied')
  }

  const clear = () => {
    setSource('')
    setResult('')
    setParsed(undefined)
    setError('')
  }

  const setAllExpanded = (expanded: boolean) => {
    setTreeState((state) => ({ revision: state.revision + 1, expanded }))
  }

  const escapeJson = () => {
    if (!source) {
      setError('Paste JSON into the left editor first')
      return
    }
    const escaped = JSON.stringify(source).slice(1, -1)
    setResult(escaped)
    setParsed(undefined)
    setViewMode('text')
    setError('')
    notify('JSON escaped')
  }

  const unescapeJson = () => {
    if (!source) {
      setError('Paste escaped JSON into the left editor first')
      return
    }
    try {
      const trimmed = source.trim()
      const decoded = trimmed.startsWith('"') && trimmed.endsWith('"')
        ? JSON.parse(trimmed)
        : JSON.parse(`"${trimmed}"`)
      if (typeof decoded !== 'string') throw new Error('The input is not an escaped JSON string')
      setResult(decoded)
      try {
        setParsed(JSON.parse(decoded) as JsonValue)
      } catch {
        setParsed(undefined)
      }
      setViewMode('text')
      setError('')
      notify('JSON unescaped')
    } catch (caught) {
      setResult('')
      setParsed(undefined)
      setError(caught instanceof Error ? caught.message : 'Unable to unescape JSON')
    }
  }

  const searchResult = () => {
    if (viewMode === 'text' && resultEditorRef.current) {
      openEditorSearch(resultEditorRef.current)
      return
    }
    pendingResultSearch.current = true
    setViewMode('text')
  }

  const onResultEditorMount: OnMount = (editor) => {
    resultEditorRef.current = editor
    if (pendingResultSearch.current) {
      pendingResultSearch.current = false
      window.setTimeout(() => openEditorSearch(editor), 0)
    }
  }

  return (
    <div className="tool-layout editor-tool">
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="primary-button" onClick={() => transform(false)}><Play size={15} fill="currentColor" />Format</button>
          <button className="secondary-button" onClick={() => transform(true)}><Minimize2 size={15} />Minify</button>
          <button className="secondary-button" onClick={escapeJson}>Escape</button>
          <button className="secondary-button" onClick={unescapeJson}>Unescape</button>
        </div>
        <div className="toolbar-group">
          {parsed !== undefined && (
            <div className="view-switcher" aria-label="Result view">
              <button className={viewMode === 'tree' ? 'active' : ''} onClick={() => setViewMode('tree')}>Tree</button>
              <button className={viewMode === 'text' ? 'active' : ''} onClick={() => setViewMode('text')}>Source</button>
            </div>
          )}
          <button className="ghost-button" onClick={copy} disabled={!result}><Copy size={15} />Copy result</button>
          <button className="ghost-button" onClick={clear}><Eraser size={15} />Clear</button>
        </div>
      </div>

      <div className="split-editors">
        <EditorPanel
          title="Raw JSON"
          badge="INPUT"
          headerAction={<PanelSearchButton onClick={() => openEditorSearch(sourceEditorRef.current)} />}
        >
          <Editor
            value={source}
            onChange={(value) => setSource(value ?? '')}
            onMount={(editor) => { sourceEditorRef.current = editor }}
            language="json"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={editorOptions(false)}
          />
        </EditorPanel>
        <div className="editor-panel">
          <div className="editor-panel-header">
            <span>Formatted result</span>
            <div className="panel-header-actions">
              {viewMode === 'tree' && parsed !== undefined && (
                <div className="tree-actions">
                  <button onClick={() => setAllExpanded(true)} title="Expand all"><ChevronsDown size={14} />Expand all</button>
                  <button onClick={() => setAllExpanded(false)} title="Collapse all"><ChevronsUp size={14} />Collapse all</button>
                </div>
              )}
              <PanelSearchButton onClick={searchResult} disabled={!result} />
            </div>
          </div>
          <div className="editor-container">
            {viewMode === 'tree' ? (
              <JsonTree value={parsed} treeState={treeState} />
            ) : (
              <Editor
                value={result}
                onMount={onResultEditorMount}
                language="json"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                options={editorOptions(true)}
              />
            )}
          </div>
        </div>
      </div>
      {error && <div className="error-banner"><span>!</span>{error}</div>}
    </div>
  )
}

function JsonTree({ value, treeState }: { value: JsonValue | undefined; treeState: { revision: number; expanded: boolean } }) {
  if (value === undefined) {
    return <div className="json-tree-empty"><Braces size={27} /><span>Your collapsible JSON tree will appear here</span></div>
  }

  return (
    <div className="json-tree" role="tree" aria-label="JSON tree result">
      <JsonTreeNode label="root" value={value} depth={0} treeState={treeState} />
    </div>
  )
}

function JsonTreeNode({
  label,
  value,
  depth,
  treeState,
}: {
  label: string
  value: JsonValue
  depth: number
  treeState: { revision: number; expanded: boolean }
}) {
  const [expanded, setExpanded] = useState(true)
  const isArray = Array.isArray(value)
  const isObject = value !== null && typeof value === 'object'
  const entries = isObject ? Object.entries(value) : []
  const expandable = entries.length > 0

  useEffect(() => {
    setExpanded(treeState.expanded)
  }, [treeState])

  if (!isObject) {
    return (
      <div className="json-tree-row" role="treeitem">
        <span className="tree-spacer" />
        <span className={`tree-key ${/^\d+$/.test(label) ? 'index' : ''}`}>{label}</span>
        <span className="tree-colon">:</span>
        <JsonPrimitive value={value} />
      </div>
    )
  }

  const summary = isArray ? `[${entries.length}]` : `{${entries.length}}`
  return (
    <div className="json-tree-node" role="treeitem" aria-expanded={expandable ? expanded : undefined}>
      <div className="json-tree-row">
        {expandable ? (
          <button className="tree-toggle" onClick={() => setExpanded((current) => !current)} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}>
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : <span className="tree-spacer" />}
        <span className={`tree-key ${/^\d+$/.test(label) ? 'index' : ''}`}>{label}</span>
        <span className="tree-summary">{summary}</span>
      </div>
      {expanded && expandable && (
        <div className="json-tree-children" role="group">
          {entries.map(([key, child]) => (
            <JsonTreeNode key={`${depth}-${key}`} label={key} value={child} depth={depth + 1} treeState={treeState} />
          ))}
        </div>
      )}
    </div>
  )
}

function JsonPrimitive({ value }: { value: JsonValue }) {
  if (value === null) return <span className="tree-value null">null</span>
  if (typeof value === 'string') return <span className="tree-value string">&quot;{value}&quot;</span>
  if (typeof value === 'boolean') return <span className="tree-value boolean">{String(value)}</span>
  return <span className="tree-value number">{String(value)}</span>
}

function TextDiff({ theme, notify }: { theme: Theme; notify: (message: string) => void }) {
  const diffRef = useRef<Parameters<DiffOnMount>[0] | null>(null)

  const onMount: DiffOnMount = (editor) => {
    diffRef.current = editor
  }

  const clear = () => {
    diffRef.current?.getOriginalEditor().setValue('')
    diffRef.current?.getModifiedEditor().setValue('')
    notify('Content cleared')
  }

  return (
    <div className="tool-layout editor-tool">
      <div className="toolbar">
        <div className="diff-legend">
          <span><i className="legend-dot removed" />Original</span>
          <span><i className="legend-dot added" />Modified</span>
        </div>
        <button className="ghost-button" onClick={clear}><Eraser size={15} />Clear</button>
      </div>
      <div className="single-editor-frame">
        <div className="diff-headings">
          <div><span>Original</span><PanelSearchButton onClick={() => openEditorSearch(diffRef.current?.getOriginalEditor() ?? null)} /></div>
          <div><span>Modified</span><PanelSearchButton onClick={() => openEditorSearch(diffRef.current?.getModifiedEditor() ?? null)} /></div>
        </div>
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

function PanelSearchButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="panel-search-button" onClick={onClick} disabled={disabled} title="Search" aria-label="Search this panel">
      <Search size={14} />Search
    </button>
  )
}

function EditorPanel({
  title,
  badge,
  headerAction,
  children,
}: {
  title: string
  badge: string
  headerAction?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="editor-panel">
      <div className="editor-panel-header">
        <span>{title}</span>
        <div className="panel-header-actions"><small>{badge}</small>{headerAction}</div>
      </div>
      <div className="editor-container">{children}</div>
    </div>
  )
}

function UrlCodec({ notify }: { notify: (message: string) => void }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'component' | 'url'>('component')
  const [error, setError] = useState('')

  const transformUrl = (operation: 'encode' | 'decode') => {
    if (!input) {
      setOutput('')
      setError('Enter a URL or text to process')
      return
    }
    try {
      const next = operation === 'encode'
        ? mode === 'component' ? encodeURIComponent(input) : encodeURI(input)
        : mode === 'component' ? decodeURIComponent(input) : decodeURI(input)
      setOutput(next)
      setError('')
      notify(operation === 'encode' ? 'URL encoded' : 'URL decoded')
    } catch (caught) {
      setOutput('')
      setError(caught instanceof Error ? caught.message : 'Unable to process this value')
    }
  }

  const copyOutput = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    notify('Result copied')
  }

  const clear = () => {
    setInput('')
    setOutput('')
    setError('')
  }

  return (
    <div className="tool-layout editor-tool url-codec-tool">
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="primary-button" onClick={() => transformUrl('encode')}>Encode</button>
          <button className="secondary-button" onClick={() => transformUrl('decode')}>Decode</button>
          <div className="view-switcher" aria-label="Encoding scope">
            <button className={mode === 'component' ? 'active' : ''} onClick={() => setMode('component')}>Component</button>
            <button className={mode === 'url' ? 'active' : ''} onClick={() => setMode('url')}>Full URL</button>
          </div>
        </div>
        <div className="toolbar-group">
          <button className="ghost-button" onClick={copyOutput} disabled={!output}><Copy size={15} />Copy result</button>
          <button className="ghost-button" onClick={clear}><Eraser size={15} />Clear</button>
        </div>
      </div>
      <div className="split-editors url-panels">
        <div className="editor-panel">
          <div className="editor-panel-header"><span>Input</span><small>RAW</small></div>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter a URL, query parameter, or text…" autoFocus />
        </div>
        <div className="editor-panel">
          <div className="editor-panel-header"><span>Result</span><small>OUTPUT</small></div>
          <textarea value={output} readOnly placeholder="The encoded or decoded result will appear here…" />
        </div>
      </div>
      {error && <div className="error-banner"><span>!</span>{error}</div>}
      <p className="tool-hint">Component mode encodes reserved URL characters. Full URL mode preserves URL structure such as : / ? &amp; = and #.</p>
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
    notify('Copied')
  }

  const resetNow = () => {
    const current = new Date()
    setTimestamp(String(unit === 's' ? Math.floor(current.getTime() / 1000) : current.getTime()))
    setDateInput(localDateTimeValue(current))
    notify('Updated to the current time')
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
        <div className="segmented" aria-label="Timestamp unit">
          <button className={unit === 's' ? 'active' : ''} onClick={() => changeUnit('s')}>Seconds (s)</button>
          <button className={unit === 'ms' ? 'active' : ''} onClick={() => changeUnit('ms')}>Milliseconds (ms)</button>
        </div>
        <button className="secondary-button" onClick={resetNow}><Clock3 size={15} />Use current time</button>
      </div>

      <div className="converter-grid">
        <article className="converter-card">
          <div className="card-eyebrow"><Hash size={16} />Timestamp → Date</div>
          <h2>Enter a timestamp</h2>
          <div className="input-with-unit">
            <input value={timestamp} onChange={(event) => setTimestamp(event.target.value)} inputMode="numeric" />
            <span>{unit}</span>
          </div>
          <div className="result-box">
            <span>Local time</span>
            <strong>{timestampDate ? formatLocalDate(timestampDate) : 'Enter a valid timestamp'}</strong>
            <button onClick={() => copyValue(timestampDate ? formatLocalDate(timestampDate) : '')} aria-label="Copy date"><Clipboard size={16} /></button>
          </div>
        </article>

        <article className="converter-card">
          <div className="card-eyebrow"><Clock3 size={16} />Date → Timestamp</div>
          <h2>Select a local date and time</h2>
          <input className="date-input" type="datetime-local" step="1" value={dateInput} onChange={(event) => setDateInput(event.target.value)} />
          <div className="result-box">
            <span>{unit === 's' ? 'Timestamp in seconds' : 'Timestamp in milliseconds'}</span>
            <strong className="mono">{dateTimestamp || '—'}</strong>
            <button onClick={() => copyValue(dateTimestamp)} aria-label="Copy timestamp"><Clipboard size={16} /></button>
          </div>
        </article>
      </div>
      <p className="tool-hint">Dates are converted using your browser's local time zone.</p>
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
        <StatCard label="Characters" value={stats.characters} accent />
        <StatCard label="Non-whitespace" value={stats.nonWhitespace} />
        <StatCard label="Chinese characters" value={stats.chinese} />
        <StatCard label="Words" value={stats.words} />
      </div>
      <div className="text-area-card">
        <div className="text-area-head">
          <span>Text input</span>
          <div><span>{stats.lines} lines</span><button onClick={() => setText('')} disabled={!text}><Eraser size={14} />Clear</button></div>
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type or paste text here to see live statistics…"
          autoFocus
        />
      </div>
      <p className="tool-hint">Characters include letters, punctuation, spaces, and line breaks. Non-whitespace excludes all spacing characters.</p>
    </div>
  )
}

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`stat-card ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value.toLocaleString('en-US')}</strong></div>
}

export default App
