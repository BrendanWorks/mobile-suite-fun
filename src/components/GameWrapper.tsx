import React, { useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
import VisualTimerBar from './VisualTimerBar';
import { playTimerCountdown, stopTimerCountdown, playHurryUp, playTimeUp, isTimerCountdownReady } from '../lib/sounds';

interface GameWrapperProps {
  duration: number;
  onComplete: (rawScore: number, maxScore: number, timeRemaining?: number) => void;
  gameName: string;
  onScoreUpdate: (score: number, maxScore: number) => void;
  children: ReactNode;
  debugMode?: boolean;
}

export default function GameWrapper({
  duration,
  onComplete,
  gameName,
  onScoreUpdate,
  children,
  debugMode = false,
}: GameWrapperProps) {
  const POST_ZERO_LINGER_MS = 700;

  const skipTimer = gameName === 'Debris';

  const childHideTimer = React.isValidElement(children)
    ? (children as React.ReactElement<any>).props.hideTimer === true
    : false;
  const childMuteTimerSounds = React.isValidElement(children)
    ? (children as React.ReactElement<any>).props.muteTimerSounds === true
    : false;

  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isActive, setIsActive] = useState(true);
  const [isFastCountdown, setIsFastCountdown] = useState(false);
  const [hideTimerBar, setHideTimerBar] = useState(skipTimer || childHideTimer);
  const [muteTimerSounds, setMuteTimerSounds] = useState(childMuteTimerSounds);

  const timerRef = useRef<number | null>(null);
  const lingerTimeoutRef = useRef<number | null>(null);
  const childrenRef = useRef<any>(null);
  const gameCompletedRef = useRef(false);
  const finalScoreRef = useRef<{ score: number; maxScore: number; timeRemaining: number } | null>(null);
  const hasReportedCompletion = useRef(false);
  const hurryUpFiredRef = useRef(false);
  const countdownIntervalRef = useRef<number | null>(null);
  const timerSoundPausedRef = useRef(false);
  const timerSoundPollRef = useRef<number | null>(null);
  const timeRemainingRef = useRef(duration);
  const hideTimerBarRef = useRef(false);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    hideTimerBarRef.current = hideTimerBar;
  }, [hideTimerBar]);

  useEffect(() => {
    if (childrenRef.current?.hideTimer) {
      setHideTimerBar(true);
    }
    if (childrenRef.current?.muteTimerSounds) {
      setMuteTimerSounds(true);
    }
  }, [children]);

  const soundsMuted = hideTimerBar || muteTimerSounds || debugMode;

  useEffect(() => {
    if (soundsMuted) return;

    let retryTimeoutId: number | null = null;

    const startCountdownAndPoll = () => {
      playTimerCountdown();
      countdownIntervalRef.current = window.setInterval(() => {
        playTimerCountdown();
      }, 3000);

      timerSoundPollRef.current = window.setInterval(() => {
        const wantsPause = childrenRef.current?.pauseTimer === true;
        if (wantsPause && !timerSoundPausedRef.current) {
          timerSoundPausedRef.current = true;
          stopTimerCountdown();
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        } else if (!wantsPause && timerSoundPausedRef.current) {
          timerSoundPausedRef.current = false;
          playTimerCountdown();
          countdownIntervalRef.current = window.setInterval(() => {
            playTimerCountdown();
          }, 3000);
        }
      }, 100);
    };

    if (isTimerCountdownReady()) {
      startCountdownAndPoll();
    } else {
      const retry = () => {
        if (isTimerCountdownReady()) {
          startCountdownAndPoll();
        } else {
          retryTimeoutId = window.setTimeout(retry, 100);
        }
      };
      retryTimeoutId = window.setTimeout(retry, 100);
    }

    return () => {
      if (retryTimeoutId !== null) window.clearTimeout(retryTimeoutId);
      stopTimerCountdown();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (timerSoundPollRef.current) {
        clearInterval(timerSoundPollRef.current);
        timerSoundPollRef.current = null;
      }
    };
  }, [soundsMuted]);

  useEffect(() => {
    if (soundsMuted) return;
    if (!isActive) {
      stopTimerCountdown();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (timerSoundPollRef.current) {
        clearInterval(timerSoundPollRef.current);
        timerSoundPollRef.current = null;
      }
    }
  }, [isActive, soundsMuted]);

  useEffect(() => {
    if (soundsMuted) return;
    const isPaused = childrenRef.current?.pauseTimer === true;
    if (isPaused) return;
    if (timeRemaining <= 5 && timeRemaining > 0 && !hurryUpFiredRef.current) {
      hurryUpFiredRef.current = true;
      stopTimerCountdown();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      playHurryUp();
    }
  }, [timeRemaining, soundsMuted]);

  const handleEarlyCompletion = useCallback(() => {
    console.error('🔴 EARLY COMPLETION FIRED');
    console.trace();
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    gameCompletedRef.current = true;
    hasReportedCompletion.current = true;
    setIsActive(false);
    setIsFastCountdown(false);
    stopTimerCountdown();

    const final = finalScoreRef.current;
    if (final) {
      onComplete(final.score, final.maxScore, final.timeRemaining);
    } else {
      onComplete(0, 100, 0);
    }
  }, [onComplete]);

  const handleTimeUp = useCallback(() => {
    console.error('🔴 TIME UP FIRED - this should not happen for Debris (999999ms duration)');
    console.trace();
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    setIsActive(false);
    setIsFastCountdown(false);
    stopTimerCountdown();

    if (hasReportedCompletion.current) return;
    hasReportedCompletion.current = true;
    playTimeUp();

    const final = finalScoreRef.current;
    if (final) {
      onComplete(final.score, final.maxScore, final.timeRemaining);
      return;
    }

    if (!gameCompletedRef.current) {
      gameCompletedRef.current = true;

      if (childrenRef.current?.onGameEnd) {
        childrenRef.current.onGameEnd();
      }

      if (finalScoreRef.current) {
        const f = finalScoreRef.current;
        onComplete(f.score, f.maxScore, f.timeRemaining);
        return;
      }

      if (childrenRef.current?.getGameScore) {
        const { score, maxScore } = childrenRef.current.getGameScore();
        onComplete(score, maxScore, 0);
      } else {
        onComplete(0, 100, 0);
      }
    }
  }, [onComplete]);

  // TIMER EFFECT - skipped entirely for games that manage their own lifecycle (e.g. Debris).
  // Those games call onComplete() themselves; we must not tick them to zero.
  useEffect(() => {
    if (!isActive) return;
    if (debugMode) return;
    if (skipTimer) return;

    const intervalTime = isFastCountdown ? 25 : 1000;
    const decrement = isFastCountdown ? 3 : 1;

    timerRef.current = window.setInterval(() => {
      console.log('⏱️ TIMER TICK', { timeRemaining: timeRemainingRef.current, isActive, isFastCountdown });
      setTimeRemaining((prev) => {
        let newTime = prev;

        if (newTime <= 0) {
          if (!hasReportedCompletion.current) {
            handleTimeUp();
          }
          return 0;
        }

        if (isFastCountdown) {
          newTime = Math.max(0, prev - decrement);
        } else {
          const isPaused = childrenRef.current?.pauseTimer === true;
          if (!isPaused) {
            newTime = Math.max(0, prev - decrement);
          }
        }

        if (newTime <= 0) {
          if (isFastCountdown) {
            if (lingerTimeoutRef.current) clearTimeout(lingerTimeoutRef.current);
            hasReportedCompletion.current = true;

            lingerTimeoutRef.current = window.setTimeout(() => {
              handleEarlyCompletion();
            }, POST_ZERO_LINGER_MS);
          } else {
            handleTimeUp();
          }
        }

        return newTime;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (lingerTimeoutRef.current) clearTimeout(lingerTimeoutRef.current);
    };
  }, [isActive, isFastCountdown, skipTimer]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleGameComplete = useCallback((score: number, maxScore: number, remaining?: number) => {
    if (gameCompletedRef.current) return;
    gameCompletedRef.current = true;

    const effectiveRemaining = remaining ?? timeRemainingRef.current;
    finalScoreRef.current = { score, maxScore, timeRemaining: effectiveRemaining };

    if (hideTimerBarRef.current) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      hasReportedCompletion.current = true;
      onComplete(score, maxScore, effectiveRemaining);
      return;
    }

    if (effectiveRemaining > 1.5) {
      hurryUpFiredRef.current = true;
      setIsFastCountdown(true);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsActive(false);
      setIsFastCountdown(false);
      setTimeRemaining(0);
      stopTimerCountdown();
      hasReportedCompletion.current = true;
      onComplete(score, maxScore, effectiveRemaining);
    }
  }, [onComplete]);

  const clonedChildren = useMemo(() => {
    if (!children) return null;
    if (React.isValidElement(children)) {
      const childProps = (children as React.ReactElement<any>).props;
      return React.cloneElement(children as React.ReactElement<any>, {
        ...childProps,
        ref: childrenRef,
        onScoreUpdate,
        onComplete: handleGameComplete,
        timeRemaining,
        duration,
      });
    }
    return children;
  }, [children, onScoreUpdate, timeRemaining, duration, handleGameComplete]);

  return (
    <div className="h-full w-full flex flex-col bg-black" style={{ position: 'relative' }}>
      {!hideTimerBar && !debugMode && <VisualTimerBar totalTime={duration} timeRemaining={timeRemaining} />}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {clonedChildren}
      </div>
    </div>
  );
}
