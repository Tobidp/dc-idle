import type { ReactNode } from 'react'

export function Panel(props: { title?: string; children: ReactNode }) {
  return (
    <section className="panel">
      {props.title ? <h2 className="panel-title">{props.title}</h2> : null}
      {props.children}
    </section>
  )
}
