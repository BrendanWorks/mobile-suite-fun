/**
 * WordSurge - BRANDED EDITION
 * Type icon, blue theme, "Make Words" tagline
 * - 90 second rounds
 * - Score can exceed 1000 (maxScore = 1000 baseline)
 * - Auto-advances after Round Complete screen
 */

import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Type } from 'lucide-react';

interface WordRescueProps {
  onScoreUpdate?: (score: number, maxScore: number) => void;
  onComplete?: (score: number, maxScore: number) => void;
}

const MAX_SCORE = 1000;

const WordRescue = forwardRef<any, WordRescueProps>((props, ref) => {
  // Word list for validation
  const fallbackWords = new Set([
    'cat', 'dog', 'run', 'fun', 'sun', 'car', 'art', 'bat', 'hat', 'rat',
    'can', 'man', 'pan', 'tan', 'van', 'ban', 'fan', 'ran', 'win', 'bin',
    'big', 'dig', 'fig', 'pig', 'wig', 'bag', 'tag', 'leg', 'beg', 'egg',
    'bug', 'hug', 'jug', 'mug', 'rug', 'cut', 'but', 'nut', 'put', 'sit',
    'bit', 'fit', 'hit', 'kit', 'lit', 'top', 'hop', 'pop', 'got', 'hot',
    'lot', 'not', 'pot', 'red', 'bed', 'bad', 'dad', 'had', 'mad', 'sad',
    'all', 'old', 'any', 'may', 'day', 'way', 'say', 'try', 'dry', 'cry',
    'fly', 'sky', 'new', 'low', 'how', 'now', 'saw', 'box', 'fox', 'mix',
    'fix', 'six', 'age', 'ice', 'eye', 'die', 'lie', 'pie', 'tie', 'use',
    'sea', 'tea', 'bee', 'see', 'too', 'boy', 'toy', 'job', 'oil', 'eat',
    'book', 'look', 'took', 'cook', 'good', 'food', 'door', 'tree', 'free',
    'blue', 'true', 'game', 'name', 'same', 'came', 'time', 'fire', 'wire',
    'bird', 'word', 'work', 'walk', 'talk', 'rock', 'lock', 'love', 'move',
    'live', 'give', 'hand', 'land', 'sand', 'wind', 'find', 'play', 'stay',
    'home', 'come', 'some', 'make', 'take', 'back', 'pack', 'help', 'bell',
    'tell', 'well', 'ball', 'call', 'fall', 'tall', 'wall', 'bill', 'fill',
    'hill', 'will', 'gold', 'hold', 'cold', 'told', 'kind', 'mind', 'find',
    'turn', 'burn', 'park', 'dark', 'mark', 'work', 'part', 'cart', 'fast',
    'last', 'past', 'best', 'test', 'rest', 'just', 'must', 'face', 'race',
    'nice', 'rice', 'once', 'done', 'gone', 'line', 'mine', 'fine', 'like',
    'water', 'after', 'other', 'think', 'about', 'right', 'would', 'could',
    'first', 'world', 'great', 'small', 'white', 'black', 'green', 'light',
    'night', 'might', 'start', 'heart', 'party', 'happy', 'early', 'ready',
    'money', 'funny', 'bread', 'great', 'plant', 'point', 'sound', 'round',
    'letter', 'better', 'little', 'simple', 'people', 'purple', 'circle',
    'hog', 'log', 'fog', 'cog', 'bog', 'jog', 'dog', 'sin', 'din', 'gin',
    'pin', 'tin', 'fin', 'kin', 'dim', 'him', 'rim', 'gym', 'sum', 'gum',
    'hum', 'rum', 'bum', 'yum', 'gun', 'bun', 'nun', 'pun', 'sub', 'rub',
    'hub', 'pub', 'cub', 'tub', 'mud', 'bud', 'cud', 'dud', 'hut', 'gut',
    'jut', 'rut', 'shut', 'what', 'that', 'chat', 'flat', 'brat', 'spat',
    'scat', 'spot', 'shot', 'slot', 'plot', 'clot', 'blot', 'snot', 'trot',
    'drop', 'crop', 'prop', 'shop', 'chop', 'stop', 'flop', 'plop', 'mop',
    'sip', 'nip', 'dip', 'hip', 'lip', 'rip', 'tip', 'zip', 'grip', 'trip',
    'slip', 'flip', 'clip', 'ship', 'chip', 'whip', 'skip', 'drip', 'strip',
    'snap', 'trap', 'wrap', 'clap', 'flap', 'slap', 'chap', 'gap', 'lap',
    'map', 'nap', 'rap', 'sap', 'tap', 'cap', 'zap', 'step', 'prep', 'rep',
    'pep', 'yep', 'grip', 'drip', 'strip', 'chip', 'whip', 'skip', 'trip',
    'slip', 'flip', 'clip', 'ship', 'snap', 'trap', 'wrap', 'clap', 'flap',
    'glad', 'brad', 'chad', 'shad', 'grad', 'clad', 'scad', 'bid', 'did',
    'hid', 'kid', 'lid', 'rid', 'skid', 'grid', 'slid', 'god', 'nod', 'pod',
    'rod', 'sod', 'cod', 'plod', 'prod', 'clod', 'shod', 'trod', 'broad'
  ]);

  const validateWord = async (word) => {
    const cleanWord = word.toLowerCase().trim();
    
    if (cleanWord.length < 2) return false;
    
    const consonantOnly = /^[bcdfghjklmnpqrstvwxyz]+$/i.test(cleanWord);
    const vowelOnly = /^[aeiou]+$/i.test(cleanWord);
    if (consonantOnly || vowelOnly) {
      return false;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data) && data.length > 0 && 
            data[0].meanings && Array.isArray(data[0].meanings) && 
            data[0].meanings.length > 0 && data[0].meanings[0].definitions &&
            Array.isArray(data[0].meanings[0].definitions) && 
            data[0].meanings[0].definitions.length > 0) {
          return true;
        }
      }
    } catch (error) {
      // Fall through to fallback check
    }
    
    return fallbackWords.has(cleanWord);
  };

  const profanityWords = ['fuck', 'shit', 'damn', 'ass', 'bitch', 'hell', 'cunt'];

  const [gameState, setGameState] = useState('menu');
  const [letters, setLetters] = useState([]);
  const [poppingLetters, setPoppingLetters] = useState([]);
  const [selectedLetters, setSelectedLetters] = useState([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameSpeed, setGameSpeed] = useState(2500);
  const [nextId, setNextId] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [wordsFound, setWordsFound] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [scoreNotifications, setScoreNotifications] = useState([]);
  const submissionInProgress = useRef(false);
  const audioContext = useRef(null);
  const audioBuffers = useRef(new Map());
  const audioInitialized = useRef(false);
  const roundEndTimeoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: score,
      maxScore: MAX_SCORE
    }),
    onGameEnd: () => {
      if (roundEndTimeoutRef.current) {
        clearTimeout(roundEndTimeoutRef.current);
      }
    },
    canSkipQuestion: false
  }));

  const letterPool = 'AAAAAAAAEEEEEEEEIIIIIIIIOOOOOOOOUURRBBBCCCDDDFFFFGGGHHHJKKLLLMMMNNNNPPQRRRSSSSTTTTVWWXYZ';

  const initAudio = useCallback(async () => {
    if (audioInitialized.current) return;
    
    try {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      audioInitialized.current = true;
    } catch (error) {
      console.log('Audio system failed to initialize');
    }
  }, []);

  const playSound = useCallback((soundName, volume = 0.3) => {
    if (!audioContext.current || !audioInitialized.current) return;
    generateTone(soundName, volume);
  }, []);

  const generateTone = useCallback((soundName, volume = 0.3) => {
    if (!audioContext.current) return;
    
    const ctx = audioContext.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    const toneConfig = {
      select: { freq: 800, duration: 0.1, type: 'sine' },
      success: { freq: 523, duration: 0.3, type: 'sine' },
      fail: { freq: 200, duration: 0.2, type: 'sawtooth' },
      bonus: { freq: 659, duration: 0.5, type: 'sine' },
      ambient: { freq: 100, duration: 0.1, type: 'sine' }
    };
    
    const config = toneConfig[soundName] || toneConfig.select;
    
    oscillator.frequency.setValueAtTime(config.freq, ctx.currentTime);
    oscillator.type = config.type;
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration);
  }, []);

  const initAudioOnFirstTouch = useCallback(() => {
    if (!audioInitialized.current && audioContext.current) {
      audioContext.current.resume();
    }
    initAudio();
  }, [initAudio]);

  useEffect(() => {
    initAudio();
    
    const handleFirstInteraction = () => {
      initAudioOnFirstTouch();
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
    };
    
    document.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    document.addEventListener('click', handleFirstInteraction, { passive: true });
    
    return () => {
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
      if (roundEndTimeoutRef.current) {
        clearTimeout(roundEndTimeoutRef.current);
      }
    };
  }, [initAudio, initAudioOnFirstTouch]);

  const getRandomLetter = () => {
    return letterPool[Math.floor(Math.random() * letterPool.length)];
  };

  const createLetters = useCallback(() => {
    const letters = [];
    const shouldCluster = Math.random() < 0.6;
    const maxWidth = 650;

    if (shouldCluster) {
      const clusterSize = Math.floor(Math.random() * 2) + 2;
      const baseX = Math.random() * (maxWidth - 100) + 50;
      const baseY = -70;

      for (let i = 0; i < clusterSize; i++) {
        letters.push({
          id: nextId + i,
          letter: getRandomLetter(),
          x: Math.max(5, Math.min(maxWidth - 5, baseX + (Math.random() - 0.5) * 150)),
          y: baseY - (i * 70) - (Math.random() * 40),
          selected: false
        });
      }
      setNextId(prev => prev + clusterSize);
    } else {
      letters.push({
        id: nextId,
        letter: getRandomLetter(),
        x: Math.random() * (maxWidth - 10) + 5,
        y: -70,
        selected: false
      });
      setNextId(prev => prev + 1);
    }

    return letters;
  }, [nextId]);

  useEffect(() => {
    if (gameState === 'playing' && !timerStarted && letters.length > 0) {
      setTimerStarted(true);
    }
  }, [gameState, timerStarted, letters.length]);

  useEffect(() => {
    if (gameState !== 'playing' || !timerStarted) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('roundEnd');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, timerStarted]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      const newLetters = createLetters();
      setLetters(prev => [...prev, ...newLetters]);
    }, gameSpeed);

    return () => clearInterval(interval);
  }, [gameState, gameSpeed, createLetters]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      setLetters(prev => {
        const updated = prev.map(letter => ({
          ...letter,
          y: letter.y + 0.8
        }));

        return updated.filter(letter => letter.y < 450);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPoppingLetters(prev => prev.filter(letter => now - letter.popTime < 800));
      setScoreNotifications(prev => prev.filter(notification => now - notification.showTime < 1500));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gameState !== 'playing' || !timerStarted) return;

    const elapsedTime = 90 - timeLeft;
    
    if (elapsedTime === 30) {
      setGameSpeed(prev => Math.max(2000, prev - 300));
    } else if (elapsedTime === 60) {
      setGameSpeed(prev => Math.max(1500, prev - 300));
    }
  }, [timeLeft, gameState, timerStarted]);

  // Auto-advance from roundEnd screen
  useEffect(() => {
    if (gameState === 'roundEnd') {
      roundEndTimeoutRef.current = setTimeout(() => {
        if (props.onComplete) {
          props.onComplete(score, MAX_SCORE);
        }
      }, 2500);

      return () => {
        if (roundEndTimeoutRef.current) {
          clearTimeout(roundEndTimeoutRef.current);
        }
      };
    }
  }, [gameState, score, props]);

  const selectLetter = (letterId) => {
    if (selectedLetters.find(l => l.id === letterId)) return;

    const letter = letters.find(l => l.id === letterId);
    if (!letter) return;

    playSound('select', 0.2);

    setSelectedLetters(prev => [...prev, letter]);
    setLetters(prev => prev.map(l => 
      l.id === letterId ? { ...l, selected: true } : l
    ));
  };

  const submitWord = async () => {
    if (submissionInProgress.current || selectedLetters.length === 0) {
      return;
    }
    
    submissionInProgress.current = true;
    setIsValidating(true);
    
    const word = selectedLetters.map(l => l.letter).join('').toLowerCase();
    
    if (word.length < 2) {
      clearSelection();
      submissionInProgress.current = false;
      return;
    }
    
    const currentSelection = [...selectedLetters];
    const letterIds = currentSelection.map(l => l.id);
    
    setSelectedLetters([]);
    setLetters(prev => prev.map(l => 
      letterIds.includes(l.id) ? { ...l, selected: false } : l
    ));
    
    try {
      const isValid = await validateWord(word);
      
      if (isValid) {
        const isProfanity = await checkProfanity(word);
        
        if (isProfanity) {
          playSound('bonus', 0.6);
        } else {
          playSound('success', 0.4);
        }
        
        const lettersToRemove = letters.filter(l => letterIds.includes(l.id));
        
        const avgX = lettersToRemove.reduce((sum, letter) => sum + letter.x, 0) / lettersToRemove.length;
        const avgY = lettersToRemove.reduce((sum, letter) => sum + letter.y, 0) / lettersToRemove.length;
        
        setPoppingLetters(prev => [...prev, ...lettersToRemove.map(letter => ({
          ...letter,
          popTime: Date.now()
        }))]);
        
        setLetters(prev => prev.filter(l => !letterIds.includes(l.id)));
        
        let wordScore = word.length * word.length * 5;
        
        if (isProfanity) {
          wordScore *= 4;
        }
        
        setScoreNotifications(prev => [...prev, {
          id: Date.now(),
          score: wordScore,
          x: avgX,
          y: avgY,
          isProfanity: isProfanity,
          showTime: Date.now()
        }]);
        
        setScore(prev => {
          const newScore = prev + wordScore;
          if (props.onScoreUpdate) {
            props.onScoreUpdate(newScore, MAX_SCORE);
          }
          return newScore;
        });
        setWordsFound(prev => [...prev, { word, score: wordScore }]);
      } else {
        playSound('fail', 0.3);
      }
    } finally {
      setIsValidating(false);
      submissionInProgress.current = false;
    }
  };

  const clearSelection = () => {
    const letterIds = selectedLetters.map(l => l.id);
    setLetters(prev => prev.map(l => 
      letterIds.includes(l.id) ? { ...l, selected: false } : l
    ));
    setSelectedLetters([]);
  };

  const startGame = () => {
    setGameState('playing');
    setPoppingLetters([]);
    setSelectedLetters([]);
    setScore(0);
    setLevel(1);
    setGameSpeed(2500);
    setWordsFound([]);
    setIsValidating(false);
    setTimerStarted(false);
    setScoreNotifications([]);
    submissionInProgress.current = false;

    const profanityWord = profanityWords[Math.floor(Math.random() * profanityWords.length)];

    const initialLetters = [];
    const screenHeight = 300;
    const maxWidth = 650;
    const topZoneHeight = screenHeight * 0.25;
    const numInitialLetters = 18;

    const profanityLetters = profanityWord.split('').map((letter, index) => ({
      id: index,
      letter: letter.toUpperCase(),
      x: Math.random() * (maxWidth - 10) + 5,
      y: Math.random() * (topZoneHeight + 70) - 70,
      selected: false
    }));

    const fillerCount = numInitialLetters - profanityLetters.length;
    const fillerLetters = Array.from({ length: fillerCount }, (_, index) => ({
      id: profanityLetters.length + index,
      letter: getRandomLetter(),
      x: Math.random() * (maxWidth - 10) + 5,
      y: Math.random() * (topZoneHeight + 70) - 70,
      selected: false
    }));

    initialLetters.push(...profanityLetters, ...fillerLetters);

    setLetters(initialLetters);
    setNextId(numInitialLetters);
    setTimeLeft(90);

    setTimeout(() => playSound('ambient', 0.1), 500);
  };

  const resetGame = () => {
    setGameState('menu');
    setLetters([]);
    setPoppingLetters([]);
    setSelectedLetters([]);
    setWordsFound([]);
    setIsValidating(false);
    setTimerStarted(false);
    setScoreNotifications([]);
    submissionInProgress.current = false;
    if (roundEndTimeoutRef.current) {
      clearTimeout(roundEndTimeoutRef.current);
    }
  };

  const checkProfanity = async (word) => {
    try {
      const response = await fetch(`https://www.purgomalum.com/service/containsprofanity?text=${word}`);
      const isProfanity = await response.text();
      return isProfanity === 'true';
    } catch (error) {
      return false;
    }
  };

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
        <div className="text-center mb-8 border-2 border-blue-400 rounded-lg p-6" style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}>
          {/* Header with icon */}
          <div className="mb-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-blue-400 mb-1 flex items-center justify-center gap-2">
              <Type 
                className="w-8 h-8 sm:w-10 sm:h-10" 
                style={{ 
                  color: '#3b82f6',
                  filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))',
                  strokeWidth: 2
                }} 
              />
              <span style={{ textShadow: '0 0 15px #3b82f6' }}>WordSurge</span>
            </h2>
            <p className="text-blue-300 text-sm">Make Words</p>
          </div>

          <p className="text-lg mb-2 text-blue-300">Make words from falling letters!</p>
          <p className="text-sm text-blue-400 mb-2">90 seconds per round - longer words = more points!</p>
          <p className="text-xs text-yellow-400 font-semibold mb-1">🤭 Big bonus for potty mouths!</p>
          <p className="text-xs text-blue-300">🔊 Turn on sound for the full experience!</p>
        </div>
        <button 
          onClick={startGame}
          className="bg-transparent border-2 border-blue-400 text-blue-400 font-bold py-4 px-8 rounded-lg text-xl transition-all hover:bg-blue-400 hover:text-black active:scale-95"
          style={{ textShadow: '0 0 10px #3b82f6', boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}
        >
          Start Playing
        </button>
      </div>
    );
  }

  if (gameState === 'roundEnd') {
    const handleNextGame = () => {
      if (roundEndTimeoutRef.current) {
        clearTimeout(roundEndTimeoutRef.current);
      }
      if (props.onComplete) {
        props.onComplete(score, MAX_SCORE);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
        <div className="text-center mb-8 border-2 border-blue-400 rounded-lg p-6 max-w-md" style={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}>
          <h1 className="text-4xl font-bold mb-4 text-blue-400" style={{ textShadow: '0 0 15px #3b82f6' }}>🎉 Round Complete!</h1>
          <p className="text-3xl mb-4 text-yellow-400" style={{ textShadow: '0 0 15px #fbbf24' }}>Final Score: {score}</p>
          <p className="text-lg mb-6 text-blue-300">Words Found: {wordsFound.length}</p>
          
          {wordsFound.length > 0 && (
            <div className="bg-black border-2 border-blue-400/50 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto" style={{ boxShadow: 'inset 0 0 15px rgba(59, 130, 246, 0.2)' }}>
              <h3 className="text-lg font-bold mb-2 text-blue-400">Your Words:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {wordsFound.map((item, index) => (
                  <div key={index} className="flex justify-between text-blue-300">
                    <span className="uppercase font-bold">{item.word}</span>
                    <span className="text-yellow-400">+{item.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleNextGame}
            className="mt-4 bg-transparent border-2 border-blue-400 text-blue-400 font-bold py-3 px-8 rounded-lg text-lg transition-all hover:bg-blue-400 hover:text-black active:scale-95"
            style={{ textShadow: '0 0 10px #3b82f6', boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}
          >
            Next Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto h-screen bg-black overflow-hidden border-2 border-blue-400/30" style={{ height: '600px' }}>
      {/* Header - Branded */}
      <div className="absolute top-0 left-0 right-0 bg-black border-b-2 border-blue-400/50 text-white p-2 z-10">
        <div className="mb-2">
          <h2 className="text-lg sm:text-xl font-bold text-blue-400 mb-1 flex items-center justify-center gap-2">
            <Type 
              className="w-5 h-5 sm:w-6 sm:h-6" 
              style={{ 
                color: '#3b82f6',
                filter: 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))',
                strokeWidth: 2
              }} 
            />
            <span style={{ textShadow: '0 0 10px #3b82f6' }}>WordSurge</span>
          </h2>
          <p className="text-blue-300 text-xs text-center">Make Words</p>
        </div>
        
        {/* Score left-aligned */}
        <div className="flex justify-start items-center text-xs sm:text-sm">
          <div className="text-blue-300">
            Score: <strong className="text-yellow-400 tabular-nums">{score}</strong>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative w-full pt-28 pb-20" style={{ height: '300px' }}>
        {/* Regular falling letters */}
        {letters.map(letter => (
          <div
            key={letter.id}
            onClick={() => selectLetter(letter.id)}
            className={`absolute w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg cursor-pointer transform transition-all duration-200 border-2 ${
              letter.selected 
                ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400 scale-110' 
                : 'bg-black/80 border-blue-400 text-blue-400 hover:scale-105'
            }`}
            style={{
              left: `${letter.x}px`,
              top: `${letter.y}px`,
              boxShadow: letter.selected ? '0 0 20px #fbbf24' : '0 0 10px rgba(59, 130, 246, 0.3)'
            }}
          >
            {letter.letter}
          </div>
        ))}
        
        {/* Popping letters animation */}
        {poppingLetters.map(letter => {
          const elapsed = Date.now() - letter.popTime;
          const progress = elapsed / 800;
          const scale = 1 + (progress * 2);
          const opacity = Math.max(0, 1 - progress);
          
          return (
            <div
              key={`pop-${letter.id}`}
              className="absolute w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg pointer-events-none bg-green-500/30 border-2 border-green-500 text-green-400"
              style={{
                left: `${letter.x}px`,
                top: `${letter.y}px`,
                transform: `scale(${scale})`,
                opacity: opacity,
                transition: 'none',
                boxShadow: '0 0 30px rgba(34, 197, 94, 0.8)'
              }}
            >
              {letter.letter}
            </div>
          );
        })}

        {/* Score notifications */}
        {scoreNotifications.map(notification => {
          const elapsed = Date.now() - notification.showTime;
          const progress = elapsed / 1500;
          const yOffset = progress * 60;
          const opacity = Math.max(0, 1 - progress);
          
          return (
            <div
              key={`score-${notification.id}`}
              className={`absolute pointer-events-none text-2xl font-bold ${
                notification.isProfanity 
                  ? 'text-yellow-400' 
                  : 'text-green-400'
              }`}
              style={{
                left: `${notification.x}px`,
                top: `${notification.y - yOffset}px`,
                opacity: opacity,
                transition: 'none',
                textShadow: notification.isProfanity ? '0 0 20px #fbbf24' : '0 0 15px #22c55e',
                fontWeight: notification.isProfanity ? '900' : '700'
              }}
            >
              +{notification.score}{notification.isProfanity ? '!' : ''}
            </div>
          );
        })}
      </div>

      {/* Bottom Control Panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-black border-t-2 border-blue-400/50 text-white p-2.5">
        <div className="mb-2">
          <div className="text-center text-xs text-blue-400 mb-1">Selected Word:</div>
          <div className="text-center text-lg font-bold min-h-7 bg-black border-2 border-blue-400/50 rounded px-3 py-1 text-blue-300" style={{ boxShadow: 'inset 0 0 10px rgba(59, 130, 246, 0.2)' }}>
            {selectedLetters.map(l => l.letter).join('')}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={submitWord}
            disabled={selectedLetters.length === 0 || isValidating}
            className="flex-1 bg-transparent border-2 border-blue-400 text-blue-400 font-bold py-2 px-4 rounded-lg transition-all hover:bg-blue-400 hover:text-black disabled:border-blue-400/30 disabled:text-blue-400/30 disabled:hover:bg-transparent active:scale-95"
            style={selectedLetters.length > 0 && !isValidating ? { textShadow: '0 0 10px #3b82f6', boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)' } : {}}
          >
            {isValidating ? 'Checking...' : 'Submit Word'}
          </button>
          <button
            onClick={clearSelection}
            disabled={selectedLetters.length === 0}
            className="bg-transparent border-2 border-red-500 text-red-400 font-bold py-2 px-4 rounded-lg transition-all hover:bg-red-500 hover:text-black disabled:border-red-500/30 disabled:text-red-400/30 disabled:hover:bg-transparent active:scale-95"
            style={selectedLetters.length > 0 ? { textShadow: '0 0 10px #ef4444', boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)' } : {}}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
});

WordRescue.displayName = 'WordRescue';

export default WordRescue;