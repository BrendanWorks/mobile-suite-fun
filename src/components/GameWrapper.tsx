// ... imports remain the same

export default function GameWrapper({
  duration,
  onComplete,
  gameName,
  onScoreUpdate,
  children
}: GameWrapperProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isActive, setIsActive] = useState(true);
  const [isFastCountdown, setIsFastCountdown] = useState(false);
  const [hideTimerBar, setHideTimerBar] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const childrenRef = useRef<any>(null);
  const gameCompletedRef = useRef(false);
  const finalScoreRef = useRef<{ score: number; maxScore: number } | null>(null);

  // Use a ref for the interval duration to avoid re-triggering the effect
  const intervalConfig = isFastCountdown 
    ? { ms: 50, dec: 0.05 } 
    : { ms: 1000, dec: 1 };

  useEffect(() => {
    if (isActive) {
      timerRef.current = window.setInterval(() => {
        // Only run if the child explicitly says pauseTimer is false
        // Using a ref check here is fine for imperative logic
        if (childrenRef.current?.pauseTimer !== false) return;

        setTimeRemaining((prev) => {
          const nextValue = prev - intervalConfig.dec;
          if (nextValue <= 0) {
            handleTimeUp();
            return 0;
          }
          return nextValue;
        });
      }, intervalConfig.ms);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isFastCountdown]); // Removed timeRemaining from dependencies

  const handleTimeUp = () => {
    if (gameCompletedRef.current) return;
    gameCompletedRef.current = true;
    
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);

    // 1. Check for stored score (Fast Countdown finished)
    if (finalScoreRef.current) {
      onComplete(finalScoreRef.current.score, finalScoreRef.current.maxScore);
      return;
    }

    // 2. Fallback: Request score from child
    if (childrenRef.current?.onGameEnd) {
       childrenRef.current.onGameEnd();
    }

    const finalScore = childrenRef.current?.getGameScore?.() || { score: 0, maxScore: 100 };
    onComplete(finalScore.score, finalScore.maxScore);
  };

  const handleGameComplete = (score: number, maxScore: number) => {
    if (gameCompletedRef.current) return;
    
    finalScoreRef.current = { score, maxScore };

    if (timeRemaining > 2) {
      setIsFastCountdown(true);
    } else {
      gameCompletedRef.current = true;
      setIsActive(false);
      onComplete(score, maxScore);
    }
  };

  // ... cloneChildren logic