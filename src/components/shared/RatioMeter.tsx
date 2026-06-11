// Assinatura visual do produto (especificacao §17): regua numerica usado:disponivel.

export function RatioMeter(props: {
  label: string
  used: number
  max: number
  format: (n: number) => string
  hint?: string
}) {
  const ratio = props.max > 0 ? props.used / props.max : 0
  const state = ratio >= 1 ? 'crit' : ratio >= 0.8 ? 'warn' : 'ok'
  const pct = Math.min(100, Math.max(0, ratio * 100))
  return (
    <div className="meter" data-state={state}>
      <div className="meter-head">
        <span className="meter-label">{props.label}</span>
        <span className="mono meter-values">
          {props.format(props.used)} <span className="dim">/ {props.format(props.max)}</span>
        </span>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={props.max}
        aria-valuenow={props.used}
      >
        <div className="meter-fill" style={{ width: pct + '%' }} />
      </div>
      {props.hint ? <p className="meter-hint dim">{props.hint}</p> : null}
    </div>
  )
}
