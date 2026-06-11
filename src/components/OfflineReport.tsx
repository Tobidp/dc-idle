import { useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import { fmtDuration, fmtGameTime, fmtMoney } from '../utils/format'
import { BAL } from '../data/balance'

export function OfflineReport() {
  const report = useGame((s) => s.ui.offlineReport)
  const dismiss = useGame((s) => s.dismissOffline)
  if (!report) return null
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={T.offline.title}>
      <div className="overlay-card">
        <h2 className="panel-title">{T.offline.title}</h2>
        <dl className="kv">
          <dt>{T.offline.elapsed}</dt>
          <dd className="mono">
            {fmtDuration(report.elapsedSeconds)}{' '}
            <span className="dim">({fmtGameTime(report.elapsedSeconds)})</span>
          </dd>
          <dt>{T.offline.paid}</dt>
          <dd className="mono">
            {fmtDuration(report.paidSeconds)}
            {report.capped ? (
              <span className="dim"> — {T.offline.capped(fmtDuration(BAL.offline.capRealSeconds))}</span>
            ) : null}
          </dd>
          <dt>{T.offline.gained}</dt>
          <dd className={'mono ' + (report.gained >= 0 ? 'ok' : 'crit')}>{fmtMoney(report.gained)}</dd>
        </dl>
        <button className="btn" onClick={dismiss}>
          {T.offline.close}
        </button>
      </div>
    </div>
  )
}
