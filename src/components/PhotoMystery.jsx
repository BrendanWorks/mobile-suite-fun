// Old: Waited for global countdown, then delayed start
useEffect(() => {
  setTimeout(() => {
    startTimers();
    setTimeout(() => startZoom(), 2000);
  }, 7000);
});

// New: Start immediately when playing
startPlaying: () => {
  setGameState('playing');
  startQuestionTimers(); // Starts both timers at once
}