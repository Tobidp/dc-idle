import { useGame, type Tab } from './state/store'
import { T } from './i18n/pt-BR'
import * as eco from './engine/economy'
import { phaseOf } from './engine/site'
import { fmtMoney, fmtPerSec } from './utils/format'
import { Dashboard } from './components/Dashboard'
import { RacksTab } from './components/RacksTab'
import { ContractsTab } from './components/ContractsTab'
import { Shop } from './components/Shop'
import { ConfigTab } from './components/ConfigTab'
import { OfflineReport } from './components/OfflineReport'
import { Boxes, FileText, LayoutDashboard, Settings, ShoppingCart } from 'lucide-react'

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: T.nav.dashboard, icon: LayoutDashboard },
  { id: 'racks', label: T.nav.racks, icon: Boxes },
  { id: 'contracts', label: T.nav.contracts, icon: FileText },
  { id: 'shop', label: T.nav.shop, icon: ShoppingCart },
  { id: 'config', label: T.nav.config, icon: Settings },
]

export default function App() {
  const s = useGame()
  const net = eco.netPerSec(s)
  const phase = phaseOf(s.infra, s.equipment.length > 0)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">{T.app.title}</span>
          <span className="mono badge">{T.app.phases[phase]}</span>
        </div>
        <div className="money-box">
          <span className="mono money">{fmtMoney(s.money)}</span>
          <span className={'mono small ' + (net >= 0 ? 'ok' : 'crit')}>{fmtPerSec(net)}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Navegação">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className="tab" aria-current={s.ui.tab === id ? 'page' : undefined} onClick={() => s.setTab(id)}>
            <Icon size={18} strokeWidth={1.5} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="content">
        {s.ui.tab === 'dashboard' ? <Dashboard /> : null}
        {s.ui.tab === 'racks' ? <RacksTab /> : null}
        {s.ui.tab === 'contracts' ? <ContractsTab /> : null}
        {s.ui.tab === 'shop' ? <Shop /> : null}
        {s.ui.tab === 'config' ? <ConfigTab /> : null}
      </main>

      <OfflineReport />
    </div>
  )
}
