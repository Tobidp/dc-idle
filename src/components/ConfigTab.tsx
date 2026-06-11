import { useState } from 'react'
import { toPayload, useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import { exportSave, importSave } from '../state/persistence'
import { Panel } from './shared/Panel'
import { AlertTriangle } from 'lucide-react'

function nowVersionRow(label: string, value: string) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="mono">{value}</dd>
    </>
  )
}

export function ConfigTab() {
  const store = useGame()
  const [exported, setExported] = useState('')
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState<null | 'ok' | 'err'>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const doExport = () => {
    store.persist()
    setExported(exportSave(toPayload(store)))
    setCopied(false)
  }

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(exported)
      setCopied(true)
    } catch {
      /* clipboard indisponivel: o usuario copia manualmente da textarea */
    }
  }

  const doImport = () => {
    try {
      const payload = importSave(importText)
      store.importPayload(payload, Date.now())
      setImportMsg('ok')
      setImportText('')
    } catch {
      setImportMsg('err')
    }
  }

  const doReset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      window.setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    store.hardReset(Date.now())
    setConfirmReset(false)
    setExported('')
  }

  return (
    <div className="stack">
      {store.ui.corruptNotice ? (
        <div className="banner warn-bg" role="alert">
          <AlertTriangle size={16} strokeWidth={1.5} aria-hidden /> {T.config.corrupt}
        </div>
      ) : null}

      <Panel title={T.config.saveInfo}>
        <dl className="kv small">
          {nowVersionRow(T.config.version, 'v' + String(store.version))}
          {nowVersionRow(T.config.created, new Date(store.createdTs).toLocaleString('pt-BR'))}
        </dl>
      </Panel>

      <Panel title={T.config.exportTitle}>
        <p className="dim small">{T.config.exportHelp}</p>
        <div className="row">
          <button className="btn" onClick={doExport}>
            {T.config.exportTitle}
          </button>
          {exported ? (
            <button className="btn" onClick={doCopy}>
              {copied ? T.config.copied : T.config.copy}
            </button>
          ) : null}
        </div>
        {exported ? (
          <textarea className="mono code-area" readOnly value={exported} rows={4} aria-label={T.config.exportTitle} />
        ) : null}
      </Panel>

      <Panel title={T.config.importTitle}>
        <p className="dim small">{T.config.importHelp}</p>
        <textarea
          className="mono code-area"
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value)
            setImportMsg(null)
          }}
          rows={4}
          aria-label={T.config.importTitle}
        />
        <div className="row">
          <button className="btn" disabled={importText.trim().length === 0} onClick={doImport}>
            {T.config.importBtn}
          </button>
          {importMsg === 'ok' ? <span className="small ok">{T.config.importOk}</span> : null}
          {importMsg === 'err' ? <span className="small crit">{T.config.importErr}</span> : null}
        </div>
      </Panel>

      <Panel title={T.config.resetTitle}>
        <p className="dim small">{T.config.resetHelp}</p>
        <button className="btn btn-danger" onClick={doReset}>
          {confirmReset ? T.config.resetConfirm : T.config.resetBtn}
        </button>
      </Panel>
    </div>
  )
}
