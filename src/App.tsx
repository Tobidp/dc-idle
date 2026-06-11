import { useGame, type Tab } from './state/store'
import { T } from './i18n/pt-BR'
import * as eco from './engine/economy'
import { phaseOf } from './engine/site'
import { fmtMoney, fmtPerSec } from './utils/format'
import { Dashboard } from './components/Dashboard'
import { RacksTab } from './components/RacksTab'
import { Shop } from './components/Shop'
import { ConfigTab } from './components/ConfigTab'
import { OfflineReport } from './components/OfflineReport'
import { Boxes, LayoutDashboard, Settings, ShoppingCart } from 'lucide-react'

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: T.nav.dashboard, icon: LayoutDashboard },
  { id: 'racks', label: T.nav.racks, icon: Boxes },
  { id: 'shop', label: T.nav.shop, icon: ShoppingCart },
  { id: 'config', label: T.nav.config, icon: Settings },
]

export default function App() {
  const tab = useGame((s) => s.ui.tab)
  const setTab = useGame((s) => s.setTab)
  const money = useGame((s) => s.money)
  const builds = useGame((s) => s.builds)
  const equipment = useGame((s) => s.equipment)
  const infra = useGame((s) => s.infra)
  const tempC = useGame((s) => s.tempC)
  const net = eco.netPerSec({ builds, equipment, infra, tempC })
  const phase = phaseOf(infra, equipment.length > 0)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">{T.app.title}</span>
          <span className="mono badge">{T.app.phases[phase]}</span>
        </div>
        <div className="money-box">
          <span className="mono money">{fmtMoney(money)}</span>
          <span className={'mono small ' + (net >= 0 ? 'ok' : 'crit')}>{fmtPerSec(net)}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Navegação">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <Icon size={18} strokeWidth={1.5} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'dashboard' ? <Dashboard /> : null}
        {tab === 'racks' ? <RacksTab /> : null}
        {tab === 'shop' ? <Shop /> : null}
        {tab === 'config' ? <ConfigTab /> : null}
      </main>

      <OfflineReport />
    </div>
  )
}
