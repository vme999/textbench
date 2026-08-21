import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { DiffEditor, type DiffOnMount, type OnMount } from '@monaco-editor/react'
import {
  AlignLeft,
  ArrowRight,
  Binary,
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
  Fingerprint,
  Gamepad2,
  Hash,
  LockKeyhole,
  Minimize2,
  Moon,
  Play,
  RotateCcw,
  Search,
  Sun,
  Trophy,
} from 'lucide-react'

type ToolId = 'json-format' | 'text-diff' | 'url-codec' | 'base64-codec' | 'hash-generator' | 'timestamp' | 'word-count' | 'diff-challenge'
type TimestampUnit = 'ms' | 's'
type Theme = 'dark' | 'light'
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type JsonViewMode = 'tree' | 'text'
type MonacoEditor = Parameters<OnMount>[0]
type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512'
type HashEncoding = 'hex' | 'base64'

const tools: Array<{
  id: ToolId
  label: string
  title?: string
  description: string
  icon: typeof Braces
}> = [
  { id: 'json-format', label: 'JSON Formatter', description: 'Format, minify, and validate JSON', icon: Braces },
  { id: 'text-diff', label: 'Text Diff', description: 'Compare text or code side by side', icon: Code2 },
  { id: 'timestamp', label: 'Timestamp Converter', description: 'Convert between dates and timestamps', icon: Clock3 },
  { id: 'word-count', label: 'Text Counter', description: 'Count characters and words in real time', icon: AlignLeft },
  { id: 'url-codec', label: 'URL Converter', title: 'URL Encoder / Decoder', description: 'Encode or decode URLs and URL components', icon: Hash },
  { id: 'base64-codec', label: 'Base64 Converter', title: 'Base64 Encoder / Decoder', description: 'Encode or decode UTF-8 text with Base64', icon: Binary },
  { id: 'hash-generator', label: 'Hash Generator', description: 'Generate SHA hashes from UTF-8 text', icon: Fingerprint },
  { id: 'diff-challenge', label: 'Diff Challenge', description: 'Find every hidden difference across five code reviews', icon: Gamepad2 },
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

      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <h1>{activeMeta.title ?? activeMeta.label}</h1>
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
          {activeTool === 'base64-codec' && <Base64Codec notify={notify} />}
          {activeTool === 'hash-generator' && <HashGenerator notify={notify} />}
          {activeTool === 'diff-challenge' && <DiffChallenge theme={theme} />}
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

type ChallengeStatus = 'ready' | 'playing' | 'complete' | 'failed'
type ChallengeSide = 'left' | 'right'

type ChallengeDifference = {
  left: string
  right: string
}

type ChallengeLevel = {
  name: string
  language: string
  languageLabel: string
  duration: number
  left: string
  right: string
  differences: ChallengeDifference[]
}

const challengeLevels: ChallengeLevel[] = [
  {
    name: 'JSON Basics',
    language: 'json',
    languageLabel: 'JSON',
    duration: 90,
    left: `{
  "service": "textbench",
  "enabled": true,
  "retryLimit": 3,
  "region": "us-east-1"
}`,
    right: `{
  "service": "textbench",
  "enabled": false,
  "retryLimit": 5,
  "region": "ap-southeast-1"
}`,
    differences: [
      { left: 'true', right: 'false' },
      { left: '3', right: '5' },
      { left: 'us-east-1', right: 'ap-southeast-1' },
    ],
  },
  {
    name: 'Function Review',
    language: 'javascript',
    languageLabel: 'JavaScript',
    duration: 90,
    left: `function calculateTotal(items) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price,
    0,
  )
  const tax = subtotal * 0.08
  return subtotal + tax
}`,
    right: `function calculateOrderTotal(items) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.cost,
    0,
  )
  const tax = subtotal * 0.09
  return subtotal - tax
}`,
    differences: [
      { left: 'calculateTotal', right: 'calculateOrderTotal' },
      { left: 'item.price', right: 'item.cost' },
      { left: '0.08', right: '0.09' },
      { left: 'subtotal + tax', right: 'subtotal - tax' },
    ],
  },
  {
    name: 'Query Check',
    language: 'sql',
    languageLabel: 'SQL',
    duration: 100,
    left: `SELECT
  user_id,
  COUNT(*) AS order_count,
  SUM(total_amount) AS revenue
FROM orders
WHERE status = 'completed'
  AND created_at >= '2026-01-01'
GROUP BY user_id
HAVING COUNT(*) >= 5
ORDER BY revenue DESC
LIMIT 100;`,
    right: `SELECT
  user_id,
  COUNT(*) AS purchase_count,
  SUM(net_amount) AS revenue
FROM orders
WHERE status = 'approved'
  AND created_at >= '2026-02-01'
GROUP BY user_id
HAVING COUNT(*) >= 5
ORDER BY revenue ASC
LIMIT 100;`,
    differences: [
      { left: 'order_count', right: 'purchase_count' },
      { left: 'total_amount', right: 'net_amount' },
      { left: "'completed'", right: "'approved'" },
      { left: "'2026-01-01'", right: "'2026-02-01'" },
      { left: 'revenue DESC', right: 'revenue ASC' },
    ],
  },
  {
    name: 'Config Audit',
    language: 'yaml',
    languageLabel: 'YAML',
    duration: 110,
    left: `app:
  environment: staging
  port: 5173
  debug: true
server:
  timeout: 3000
  retries: 3
cache:
  enabled: false
  ttl: 600
logging:
  level: info`,
    right: `app:
  environment: production
  port: 4173
  debug: false
server:
  timeout: 30000
  retries: 3
cache:
  enabled: true
  ttl: 600
logging:
  level: warn`,
    differences: [
      { left: 'staging', right: 'production' },
      { left: '5173', right: '4173' },
      { left: 'debug: true', right: 'debug: false' },
      { left: '3000', right: '30000' },
      { left: 'enabled: false', right: 'enabled: true' },
      { left: 'level: info', right: 'level: warn' },
    ],
  },
  {
    name: 'Release Review',
    language: 'typescript',
    languageLabel: 'TypeScript',
    duration: 120,
    left: `type UserProfile = {
  id: number
  accessGranted: boolean
}

export async function loadUser(id: number) {
  const response = await fetch(\`/api/users/\${id}\`)
  if (!response.ok) throw new Error('Request failed')

  const user = await response.json()
  return {
    id: user.id,
    authorized: user.role === 'admin',
  }
}`,
    right: `type AccountProfile = {
  id: number
  accessAllowed: boolean
}

export async function fetchUser(id: number) {
  const response = await fetch(\`/api/accounts/\${id}\`)
  if (response.ok) throw new Error('Request failed')

  const user = await response.text()
  return {
    id: user.id,
    authorized: user.role !== 'admin',
  }
}`,
    differences: [
      { left: 'UserProfile', right: 'AccountProfile' },
      { left: 'accessGranted', right: 'accessAllowed' },
      { left: 'loadUser', right: 'fetchUser' },
      { left: '/api/users/', right: '/api/accounts/' },
      { left: '!response.ok', right: 'response.ok' },
      { left: 'response.json()', right: 'response.text()' },
      { left: "user.role === 'admin'", right: "user.role !== 'admin'" },
    ],
  },
]

function formatChallengeTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function challengeRange(text: string, needle: string) {
  const offset = text.indexOf(needle)
  if (offset < 0) return undefined
  const before = text.slice(0, offset)
  const lineNumber = before.split('\n').length
  const startColumn = offset - before.lastIndexOf('\n')
  return {
    startLineNumber: lineNumber,
    startColumn,
    endLineNumber: lineNumber,
    endColumn: startColumn + needle.length,
  }
}

function DiffChallenge({ theme }: { theme: Theme }) {
  const [levelIndex, setLevelIndex] = useState(0)
  const [unlockedLevel, setUnlockedLevel] = useState(0)
  const [status, setStatus] = useState<ChallengeStatus>('ready')
  const [found, setFound] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(challengeLevels[0].duration)
  const [mistakes, setMistakes] = useState(0)
  const [scores, setScores] = useState<number[]>(Array(challengeLevels.length).fill(0))
  const leftEditor = useRef<MonacoEditor | null>(null)
  const rightEditor = useRef<MonacoEditor | null>(null)
  const leftDecorations = useRef<string[]>([])
  const rightDecorations = useRef<string[]>([])
  const clickHandler = useRef<(side: ChallengeSide, lineNumber: number, column: number) => void>(() => undefined)
  const level = challengeLevels[levelIndex]
  const levelScore = scores[levelIndex]
  const totalScore = scores.reduce((total, score) => total + score, 0)
  const allComplete = status === 'complete' && levelIndex === challengeLevels.length - 1

  const resetRound = (nextStatus: ChallengeStatus = 'ready') => {
    setFound([])
    setMistakes(0)
    setTimeLeft(level.duration)
    setStatus(nextStatus)
  }

  const selectLevel = (nextIndex: number) => {
    if (nextIndex > unlockedLevel) return
    setLevelIndex(nextIndex)
    setFound([])
    setMistakes(0)
    setTimeLeft(challengeLevels[nextIndex].duration)
    setStatus('ready')
  }

  useEffect(() => {
    if (status !== 'playing') return
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (document.hidden) return current
        if (current <= 1) {
          setStatus('failed')
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.location.hash = 'text-diff'
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const decorate = (editor: MonacoEditor | null, side: ChallengeSide, previous: React.MutableRefObject<string[]>) => {
      if (!editor) return
      const text = side === 'left' ? level.left : level.right
      const decorations = found.flatMap((differenceIndex) => {
        const range = challengeRange(text, level.differences[differenceIndex][side])
        return range ? [{ range, options: { inlineClassName: 'challenge-found-difference' } }] : []
      })
      previous.current = editor.deltaDecorations(previous.current, decorations)
    }
    decorate(leftEditor.current, 'left', leftDecorations)
    decorate(rightEditor.current, 'right', rightDecorations)
  }, [found, level])

  const handleEditorClick = (side: ChallengeSide, lineNumber: number, column: number) => {
    if (status !== 'playing') return
    const text = side === 'left' ? level.left : level.right
    const matchIndex = level.differences.findIndex((difference, index) => {
      if (found.includes(index)) return false
      const range = challengeRange(text, difference[side])
      return range !== undefined
        && lineNumber === range.startLineNumber
        && column >= range.startColumn
        && column <= range.endColumn
    })

    if (matchIndex < 0) {
      setMistakes((current) => current + 1)
      setTimeLeft((current) => {
        const next = Math.max(0, current - 3)
        if (next === 0) setStatus('failed')
        return next
      })
      return
    }

    const nextFound = [...found, matchIndex]
    setFound(nextFound)
    if (nextFound.length === level.differences.length) {
      const score = Math.max(0, level.differences.length * 100 + timeLeft * 5 + (mistakes === 0 ? 200 : 0) - mistakes * 25)
      setScores((current) => current.map((value, index) => index === levelIndex ? Math.max(value, score) : value))
      setUnlockedLevel((current) => Math.max(current, Math.min(levelIndex + 1, challengeLevels.length - 1)))
      setStatus('complete')
    }
  }
  clickHandler.current = handleEditorClick

  const mountChallengeEditor = (side: ChallengeSide) => (editor: MonacoEditor) => {
    if (side === 'left') leftEditor.current = editor
    else rightEditor.current = editor
    editor.onMouseDown((event) => {
      const position = event.target.position
      if (position) clickHandler.current(side, position.lineNumber, position.column)
    })
  }

  const nextLevel = () => {
    const nextIndex = Math.min(levelIndex + 1, challengeLevels.length - 1)
    setLevelIndex(nextIndex)
    setFound([])
    setMistakes(0)
    setTimeLeft(challengeLevels[nextIndex].duration)
    setStatus('playing')
  }

  const playAgain = () => {
    setLevelIndex(0)
    setUnlockedLevel(0)
    setScores(Array(challengeLevels.length).fill(0))
    setFound([])
    setMistakes(0)
    setTimeLeft(challengeLevels[0].duration)
    setStatus('ready')
  }

  const challengeEditorOptions = {
    ...editorOptions(true),
    cursorStyle: 'line' as const,
    domReadOnly: false,
    renderLineHighlight: 'none' as const,
    selectionHighlight: false,
    occurrencesHighlight: 'off' as const,
  }

  return (
    <div className={`tool-layout editor-tool challenge-tool ${status === 'complete' ? 'is-complete' : ''}`}>
      <div className="challenge-levels" aria-label="Challenge levels">
        {challengeLevels.map((item, index) => (
          <button
            key={item.name}
            className={`${index === levelIndex ? 'active' : ''} ${scores[index] ? 'passed' : ''}`}
            disabled={index > unlockedLevel}
            onClick={() => selectLevel(index)}
          >
            {index > unlockedLevel ? <LockKeyhole size={12} /> : scores[index] ? <Check size={12} /> : index + 1}
            <span>{item.name}</span>
          </button>
        ))}
      </div>

      <div className="challenge-statusbar">
        <div className="challenge-meta">
          <strong>Challenge {levelIndex + 1} of {challengeLevels.length}</strong>
          <span>{level.languageLabel}</span>
          <span>{found.length} / {level.differences.length} found</span>
          <span className={timeLeft <= 15 ? 'time-low' : ''}>{formatChallengeTime(timeLeft)}</span>
        </div>
        <div className="challenge-actions">
          <span>Score {totalScore}</span>
          {status === 'ready' && <button className="primary-button" onClick={() => setStatus('playing')}><Play size={14} fill="currentColor" />Start</button>}
          {(status === 'playing' || status === 'failed') && <button className="secondary-button" onClick={() => resetRound('playing')}><RotateCcw size={14} />Restart</button>}
        </div>
      </div>

      <div className="challenge-editor-frame">
        <div className="challenge-editor-grid">
          <EditorPanel title="Original" badge="LEFT">
            <Editor
              key={`left-${levelIndex}`}
              value={level.left}
              language={level.language}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              onMount={mountChallengeEditor('left')}
              options={challengeEditorOptions}
            />
          </EditorPanel>
          <EditorPanel title="Modified" badge="RIGHT">
            <Editor
              key={`right-${levelIndex}`}
              value={level.right}
              language={level.language}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              onMount={mountChallengeEditor('right')}
              options={challengeEditorOptions}
            />
          </EditorPanel>
        </div>

        {status === 'failed' && (
          <div className="challenge-result failed">
            <strong>Review timed out</strong>
            <span>{found.length} of {level.differences.length} differences found</span>
            <button className="secondary-button" onClick={() => resetRound('playing')}><RotateCcw size={14} />Try again</button>
          </div>
        )}

        {status === 'complete' && (
          <>
            <div className="challenge-scan" />
            <div className="challenge-result complete">
              {allComplete ? <Trophy size={20} /> : <Check size={20} />}
              <strong>{allComplete ? 'All reviews completed' : 'Challenge completed'}</strong>
              <span>{level.differences.length} differences · {mistakes} mistakes · {levelScore} points</span>
              {allComplete ? (
                <button className="primary-button" onClick={playAgain}><RotateCcw size={14} />Play again</button>
              ) : (
                <button className="primary-button" onClick={nextLevel}>Next challenge<ArrowRight size={14} /></button>
              )}
            </div>
          </>
        )}
      </div>
      <p className="tool-hint">Click a changed token in either panel. Found differences are highlighted on both sides. Press Esc to return to Text Diff.</p>
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
    <div className="tool-layout editor-tool codec-tool">
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
      <div className="split-editors codec-panels">
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

function encodeBase64(value: string, urlSafe: boolean): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const encoded = window.btoa(binary)
  return urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '') : encoded
}

function decodeBase64(value: string, urlSafe: boolean): string {
  const compact = value.replace(/\s/gu, '')
  const normalized = urlSafe ? compact.replace(/-/g, '+').replace(/_/g, '/') : compact
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) {
    throw new Error('Enter a valid Base64 value')
  }
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = window.atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('The decoded value is not valid UTF-8 text')
  }
}

function Base64Codec({ notify }: { notify: (message: string) => void }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'standard' | 'url'>('standard')
  const [error, setError] = useState('')

  const transformBase64 = (operation: 'encode' | 'decode') => {
    if (!input) {
      setOutput('')
      setError('Enter text or Base64 to process')
      return
    }
    try {
      const next = operation === 'encode'
        ? encodeBase64(input, mode === 'url')
        : decodeBase64(input, mode === 'url')
      setOutput(next)
      setError('')
      notify(operation === 'encode' ? 'Text encoded as Base64' : 'Base64 decoded')
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
    <div className="tool-layout editor-tool codec-tool">
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="primary-button" onClick={() => transformBase64('encode')}>Encode</button>
          <button className="secondary-button" onClick={() => transformBase64('decode')}>Decode</button>
          <div className="view-switcher" aria-label="Base64 variant">
            <button className={mode === 'standard' ? 'active' : ''} onClick={() => setMode('standard')}>Standard</button>
            <button className={mode === 'url' ? 'active' : ''} onClick={() => setMode('url')}>Base64URL</button>
          </div>
        </div>
        <div className="toolbar-group">
          <button className="ghost-button" onClick={copyOutput} disabled={!output}><Copy size={15} />Copy result</button>
          <button className="ghost-button" onClick={clear}><Eraser size={15} />Clear</button>
        </div>
      </div>
      <div className="split-editors codec-panels">
        <div className="editor-panel">
          <div className="editor-panel-header"><span>Input</span><small>UTF-8 / BASE64</small></div>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter UTF-8 text to encode or Base64 to decode…" autoFocus />
        </div>
        <div className="editor-panel">
          <div className="editor-panel-header"><span>Result</span><small>OUTPUT</small></div>
          <textarea value={output} readOnly placeholder="The encoded or decoded result will appear here…" />
        </div>
      </div>
      {error && <div className="error-banner"><span>!</span>{error}</div>}
      <p className="tool-hint">Standard Base64 uses +, / and padding. Base64URL uses URL-safe - and _ characters without padding.</p>
    </div>
  )
}

function HashGenerator({ notify }: { notify: (message: string) => void }) {
  const [input, setInput] = useState('')
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256')
  const [encoding, setEncoding] = useState<HashEncoding>('hex')
  const [hashes, setHashes] = useState<{ hex: string; base64: string } | null>(null)
  const [error, setError] = useState('')
  const output = hashes?.[encoding] ?? ''
  const byteCount = useMemo(() => new TextEncoder().encode(input).length, [input])

  const generate = async () => {
    if (!input) {
      setHashes(null)
      setError('Enter text to generate a hash')
      return
    }
    try {
      const digest = await window.crypto.subtle.digest(algorithm, new TextEncoder().encode(input))
      const bytes = new Uint8Array(digest)
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      setHashes({ hex, base64: window.btoa(binary) })
      setError('')
      notify(`${algorithm} hash generated`)
    } catch (caught) {
      setHashes(null)
      setError(caught instanceof Error ? caught.message : 'Unable to generate the hash')
    }
  }

  const copyOutput = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    notify('Hash copied')
  }

  const clear = () => {
    setInput('')
    setHashes(null)
    setError('')
  }

  return (
    <div className="tool-layout editor-tool codec-tool">
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="primary-button" onClick={generate}><Fingerprint size={15} />Generate</button>
          <div className="view-switcher" aria-label="Hash algorithm">
            {(['SHA-256', 'SHA-384', 'SHA-512'] as HashAlgorithm[]).map((item) => (
              <button key={item} className={algorithm === item ? 'active' : ''} onClick={() => setAlgorithm(item)}>{item}</button>
            ))}
          </div>
        </div>
        <div className="toolbar-group">
          <div className="view-switcher" aria-label="Hash output encoding">
            <button className={encoding === 'hex' ? 'active' : ''} onClick={() => setEncoding('hex')}>Hex</button>
            <button className={encoding === 'base64' ? 'active' : ''} onClick={() => setEncoding('base64')}>Base64</button>
          </div>
          <button className="ghost-button" onClick={copyOutput} disabled={!output}><Copy size={15} />Copy hash</button>
          <button className="ghost-button" onClick={clear}><Eraser size={15} />Clear</button>
        </div>
      </div>
      <div className="split-editors codec-panels">
        <div className="editor-panel">
          <div className="editor-panel-header"><span>Text input</span><small>{byteCount.toLocaleString('en-US')} UTF-8 BYTES</small></div>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setHashes(null)
              setError('')
            }}
            placeholder="Enter text to hash…"
            autoFocus
          />
        </div>
        <div className="editor-panel">
          <div className="editor-panel-header"><span>{algorithm} hash</span><small>{encoding.toUpperCase()}</small></div>
          <textarea value={output} readOnly placeholder="The generated hash will appear here…" />
        </div>
      </div>
      {error && <div className="error-banner"><span>!</span>{error}</div>}
      <p className="tool-hint">Hashing is one-way. TextBench processes the entire input locally using the browser's Web Crypto API.</p>
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
