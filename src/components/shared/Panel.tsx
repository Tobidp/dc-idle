import type { ReactNode } from 'react'

export function Panel(props: { title?: string; id?: string; children: ReactNode }) {
  return (
    <section className="panel" id={props.id}>
      {props.title ? <h2 className="panel-title">{props.title}</h2> : null}
      {props.children}
    </section>
  )
}
