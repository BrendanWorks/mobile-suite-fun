import { useState } from 'react'
import DebugMenu from './components/DebugMenu'
import PlaylistRunner from './components/PlaylistRunner'

type AppView = { screen: 'debug' } | { screen: 'playlist'; playlistId: number }

export default function App() {
  const [view, setView] = useState<AppView>({ screen: 'debug' })

  if (view.screen === 'playlist') {
    return (
      <PlaylistRunner
        playlistId={view.playlistId}
        onExit={() => setView({ screen: 'debug' })}
      />
    )
  }

  return (
    <DebugMenu
      onLoadPlaylist={(id) => setView({ screen: 'playlist', playlistId: id })}
    />
  )
}
