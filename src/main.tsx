import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles/tokens.css'
import './styles/global.css'

import App from './App'
import { useGame } from './state/store'
import { loadSave } from './state/persistence'
import { BAL } from './data/balance'

// Inicializacao fora do React (especificacao §18): load -> offline -> loop -> autosave.
const { save, corrupt } = loadSave()
useGame.getState().init(save, Date.now(), corrupt)

window.setInterval(() => useGame.getState().tickNow(Date.now()), BAL.tickMs)
window.setInterval(() => useGame.getState().persist(), BAL.autosaveMs)
window.addEventListener('beforeunload', () => useGame.getState().persist())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') useGame.getState().persist()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
