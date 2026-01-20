import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';

const WordRescue = forwardRef((props, ref) => {
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
    // Adding missing common words
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

  // API-first word validation with smart fallback
  const validateWord = async (word) => {
    const cleanWord = word.toLowerCase().trim();
    
    // Skip very short words and reject obvious non-words
    if (cleanWord.length < 2) return false;
    
    // Reject words that are just consonants or just vowels (common non-words)
    const consonantOnly = /^[bcdfghjklmnpqrstvwxyz]+$/i.test(cleanWord);
    const vowelOnly = /^[aeiou]+$/i.test(cleanWord);
    if (consonantOnly || vowelOnly) {
      console.log(`Rejected obvious non-word: ${cleanWord}`);
      return false;
    }
    
    // First try the comprehensive API with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        // Actually parse the response to make sure it's a valid word entry
        const data = await response.json();
        if (data && Array.isArray(data) && data.length > 0 && 
            data[0].meanings && Array.isArray(data[0].meanings) && 
            data[0].meanings.length > 0 && data[0].meanings[0].definitions &&
            Array.isArray(data[0].meanings[0].definitions) && 
            data[0].meanings[0].definitions.length > 0) {
          console.log(`API validated: ${cleanWord}`);
          return true;
        } else {
          console.log(`API returned incomplete data for: ${cleanWord}`);
        }
      } else {
        console.log(`API returned non-OK status for: ${cleanWord}`);
      }
    } catch (error) {
      console.log(`API failed for ${cleanWord}, checking fallback:`, error.message);
    }
    
    // Fallback to hardcoded list if API fails or times out
    const isInFallback = fallbackWords.has(cleanWord);
    if (isInFallback) {
      console.log(`Fallback validated: ${cleanWord}`);
      return true;
    } else {
      console.log(`Word not found: ${cleanWord}`);
      return false;
    }
  };

  const profanityWords = new Set([
    'damn', 'hell', 'crap', 'shit', 'fuck', 'ass', 'bitch', 'piss', 'dick', 'cock',
    'asshole', 'bastard', 'bollocks', 'bugger', 'bullshit', 'fart', 'poop',
    'tits', 'boobs', 'penis', 'vagina', 'sex'
  ]);

  const [gameState, setGameState] = useState('menu'); // 'menu', 'playing', 'roundEnd'
  const [letters, setLetters] = useState([]);
  const [poppingLetters, setPoppingLetters] = useState([]);
  const [selectedLetters, setSelectedLetters] = useState([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameSpeed, setGameSpeed] = useState(2500);
  const [nextId, setNextId] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90); // Changed from 120 to 90
  const [wordsFound, setWordsFound] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false); // New state to track timer start
  const [scoreNotifications, setScoreNotifications] = useState([]); // New state for score notifications
  const submissionInProgress = useRef(false); // Ref to synchronously block double submissions
  const audioContext = useRef(null); // Audio context for Web Audio API
  const audioBuffers = useRef(new Map()); // Store loaded audio buffers
  const audioInitialized = useRef(false); // Track if audio is ready

  useImperativeHandle(ref, () => ({
    getGameScore: () => ({
      score: score,
      maxScore: 1000
    }),
    onGameEnd: () => {
      console.log(`WordRescue ended with score: ${score} (${wordsFound.length} words)`);
    },
    canSkipQuestion: false
  }));

  // Common letters with frequency weights
  const letterPool = 'AAAAAEEEEEIIIIIOOOOOUUUUBBBCCCDDDFFFFFGGGHHHHJKKLLLMMMNNNNPPQRRRRSSSSTTTTVWWXYYZ';

  // Audio System
  const initAudio = useCallback(async () => {
    if (audioInitialized.current) return;
    
    try {
      // Create audio context
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // For now, we'll use generated tones (no files needed!)
      // You can add real audio files to public/sounds/ later and update the URLs
      const sounds = {
        select: null,   // Will use generateTone
        success: null,  // Will use generateTone
        fail: null,     // Will use generateTone  
        bonus: null,    // Will use generateTone
        ambient: null   // Will use generateTone
      };
      
      // If you want to use real audio files, uncomment and modify these:
      // const sounds = {
      //   select: '/sounds/select.mp3',
      //   success: '/sounds/success.mp3', 
      //   fail: '/sounds/fail.mp3',
      //   bonus: '/sounds/bonus.mp3',
      //   ambient: '/sounds/ambient.mp3'
      // };
      
      // Load each sound (with graceful failure for missing files)
      const loadPromises = Object.entries(sounds).map(async ([name, url]) => {
        if (!url) return; // Skip null URLs (use generated tones)
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.log(`Audio file not found: ${url} - using generated tone`);
            return;
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
          audioBuffers.current.set(name, audioBuffer);
          console.log(`Loaded sound: ${name}`);
        } catch (error) {
          console.log(`Failed to load sound ${name}, using generated tone:`, error.message);
        }
      });
      
      await Promise.all(loadPromises);
      audioInitialized.current = true;
      console.log('Audio system initialized (using generated tones)');
      
    } catch (error) {
      console.log('Audio system failed to initialize:', error.message);
    }
  }, []);

  const playSound = useCallback((soundName, volume = 0.3) => {
    if (!audioContext.current || !audioInitialized.current) return;
    
    const buffer = audioBuffers.current.get(soundName);
    if (buffer) {
      // Play loaded audio file
      try {
        const source = audioContext.current.createBufferSource();
        const gainNode = audioContext.current.createGain();
        
        source.buffer = buffer;
        gainNode.gain.value = Math.min(1, Math.max(0, volume));
        
        source.connect(gainNode);
        gainNode.connect(audioContext.current.destination);
        source.start();
      } catch (error) {
        console.log(`Failed to play sound ${soundName}:`, error.message);
      }
    } else {
      // Generate tone for sounds that don't have files yet
      generateTone(soundName, volume);
    }
  }, []);

  const generateTone = useCallback((soundName, volume = 0.3) => {
    if (!audioContext.current) return;
    
    const ctx = audioContext.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    // Different tones for different sounds
    const toneConfig = {
      select: { freq: 800, duration: 0.1, type: 'sine' },
      success: { freq: 523, duration: 0.3, type: 'sine' }, // C note
      fail: { freq: 200, duration: 0.2, type: 'sawtooth' },
      bonus: { freq: 659, duration: 0.5, type: 'sine' }, // E note
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
      console.log('Audio context resumed on user interaction');
    }
    initAudio();
  }, [initAudio]);

  // Initialize audio system on component mount
  useEffect(() => {
    // Try to initialize audio immediately (will fail on mobile until user interaction)
    initAudio();
    
    // Set up mobile audio unlock
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
    };
  }, [initAudio, initAudioOnFirstTouch]);

  const getRandomLetter = () => {
    return letterPool[Math.floor(Math.random() * letterPool.length)];
  };

  const createLetters = useCallback(() => {
    const letters = [];
    const shouldCluster = Math.random() < 0.6; // 60% chance to create cluster
    
    if (shouldCluster) {
      // Create 2-3 letters spread out more
      const clusterSize = Math.floor(Math.random() * 2) + 2;
      const baseX = Math.random() * 220 + 25; // Adjusted for bigger bubbles
      const baseY = -70; // Adjusted for bigger bubbles
      
      for (let i = 0; i < clusterSize; i++) {
        letters.push({
          id: nextId + i,
          letter: getRandomLetter(),
          x: Math.max(5, Math.min(275, baseX + (Math.random() - 0.5) * 120)), // Adjusted for bigger bubbles
          y: baseY - (i * 70) - (Math.random() * 40), // More vertical spacing
          selected: false
        });
      }
      setNextId(prev => prev + clusterSize);
    } else {
      // Single letter
      letters.push({
        id: nextId,
        letter: getRandomLetter(),
        x: Math.random() * 270 + 5, // Adjusted for bigger bubbles
        y: -70, // Adjusted for bigger bubbles
        selected: false
      });
      setNextId(prev => prev + 1);
    }
    
    return letters;
  }, [nextId]);

  // Start timer immediately when game begins (since we pre-populate letters)
  useEffect(() => {
    if (gameState === 'playing' && !timerStarted && letters.length > 0) {
      setTimerStarted(true);
    }
  }, [gameState, timerStarted, letters.length]);

  // Game timer countdown - now only starts after letters cross screen
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

  // Add new falling letters
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      const newLetters = createLetters();
      setLetters(prev => [...prev, ...newLetters]);
    }, gameSpeed);

    return () => clearInterval(interval);
  }, [gameState, gameSpeed, createLetters]);

  // Move letters down and remove ones that fall off screen
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      setLetters(prev => {
        const updated = prev.map(letter => ({
          ...letter,
          y: letter.y + 0.8
        }));

        // Remove letters that have fallen off the bottom of the screen
        return updated.filter(letter => letter.y < 600);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [gameState]);

  // Clean up popping letters and score notifications after animation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPoppingLetters(prev => prev.filter(letter => now - letter.popTime < 800));
      setScoreNotifications(prev => prev.filter(notification => now - notification.showTime < 1500));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Speed increases at 30 and 60 seconds
  useEffect(() => {
    if (gameState !== 'playing' || !timerStarted) return;

    const elapsedTime = 90 - timeLeft;
    
    if (elapsedTime === 30) {
      setGameSpeed(prev => Math.max(2000, prev - 300)); // First speed increase
      console.log('Speed increased at 30 seconds');
    } else if (elapsedTime === 60) {
      setGameSpeed(prev => Math.max(1500, prev - 300)); // Second speed increase
      console.log('Speed increased at 60 seconds');
    }
  }, [timeLeft, gameState, timerStarted]);

  const selectLetter = (letterId) => {
    if (selectedLetters.find(l => l.id === letterId)) return; // Already selected

    const letter = letters.find(l => l.id === letterId);
    if (!letter) return;

    // Play letter selection sound
    playSound('select', 0.2);

    setSelectedLetters(prev => [...prev, letter]);
    setLetters(prev => prev.map(l => 
      l.id === letterId ? { ...l, selected: true } : l
    ));
  };

  const submitWord = async () => {
    // Synchronously block multiple submissions using ref
    if (submissionInProgress.current || selectedLetters.length === 0) {
      console.log('Submission blocked - already in progress or no selection');
      return;
    }
    
    // Set the flag immediately and synchronously
    submissionInProgress.current = true;
    setIsValidating(true); // Set UI state immediately too
    
    const word = selectedLetters.map(l => l.letter).join('').toLowerCase();
    console.log('Submitting word:', word); // Debug log
    
    if (word.length < 2) {
      console.log('Word too short');
      clearSelection();
      submissionInProgress.current = false; // Reset flag
      return;
    }
    
    // Store the current selection and clear it immediately to prevent double submission
    const currentSelection = [...selectedLetters];
    const letterIds = currentSelection.map(l => l.id);
    
    // Clear selection immediately to prevent race conditions
    setSelectedLetters([]);
    setLetters(prev => prev.map(l => 
      letterIds.includes(l.id) ? { ...l, selected: false } : l
    ));
    
    try {
      const isValid = await validateWord(word);
      
      console.log('Final validation result:', isValid); // Debug log
      
      if (isValid) {
        console.log('Valid word found!'); // Debug log
        
        // Check for profanity bonus
        const isProfanity = await checkProfanity(word);
        
        // Play appropriate success sound
        if (isProfanity) {
          playSound('bonus', 0.6); // Louder for bonus!
        } else {
          playSound('success', 0.4);
        }
        
        // Valid word! Create popping animations using stored selection
        const lettersToRemove = letters.filter(l => letterIds.includes(l.id));
        
        // Calculate average position for score notification
        const avgX = lettersToRemove.reduce((sum, letter) => sum + letter.x, 0) / lettersToRemove.length;
        const avgY = lettersToRemove.reduce((sum, letter) => sum + letter.y, 0) / lettersToRemove.length;
        
        // Add letters to popping animation
        setPoppingLetters(prev => [...prev, ...lettersToRemove.map(letter => ({
          ...letter,
          popTime: Date.now()
        }))]);
        
        // Remove letters from game
        setLetters(prev => prev.filter(l => !letterIds.includes(l.id)));
        
        // Calculate score based on word length (longer words = exponentially more points)
        let wordScore = word.length * word.length * 5;
        
        // Easter egg: 4X points for profanity (using API check)
        if (isProfanity) {
          wordScore *= 4;
        }
        
        // Add score notification
        setScoreNotifications(prev => [...prev, {
          id: Date.now(),
          score: wordScore,
          x: avgX,
          y: avgY,
          isProfanity: isProfanity,
          showTime: Date.now()
        }]);
        
        console.log('Adding score:', wordScore); // Debug log
        setScore(prev => prev + wordScore);
        setWordsFound(prev => [...prev, { word, score: wordScore }]);
      } else {
        console.log('Invalid word, selection already cleared'); // Debug log
        // Play failure sound
        playSound('fail', 0.3);
        // Selection was already cleared above, so no need to do anything
      }
    } finally {
      // Always reset flags in finally block to ensure cleanup
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

    // Pre-populate top 20% of screen with letters for continuous flow
    const initialLetters = [];
    const screenHeight = 600;
    const topZoneHeight = screenHeight * 0.2; // Top 20% (120px)
    const numInitialLetters = 15; // Number of letters to start with

    // Spread letters from above screen (-70px) down to 20% mark (120px)
    // This creates a continuous flow from the start
    for (let i = 0; i < numInitialLetters; i++) {
      initialLetters.push({
        id: i,
        letter: getRandomLetter(),
        x: Math.random() * 270 + 5, // Random horizontal position
        y: Math.random() * (topZoneHeight + 70) - 70, // Range from -70 to +120px
        selected: false
      });
    }

    setLetters(initialLetters);
    setNextId(numInitialLetters);
    setTimeLeft(90);

    // Play ambient background sound at very low volume
    setTimeout(() => playSound('ambient', 0.1), 500);
  };

  const resetGame = () => {
    setGameState('menu');
    setLetters([]);
    setPoppingLetters([]);
    setSelectedLetters([]);
    setWordsFound([]);
    setIsValidating(false);
    setTimerStarted(false); // Reset timer start flag
    setScoreNotifications([]); // Reset score notifications
    submissionInProgress.current = false; // Reset submission flag
    
    // Stop any playing ambient sounds (if we were looping them)
    if (audioContext.current && audioContext.current.state === 'running') {
      // Audio context stays alive for future games
    }
  };

  const checkProfanity = async (word) => {
    try {
      const response = await fetch(`https://www.purgomalum.com/service/containsprofanity?text=${word}`);
      const isProfanity = await response.text();
      return isProfanity === 'true';
    } catch (error) {
      return false; // Fallback to no bonus if API fails
    }
  };

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-400 to-blue-600 text-white p-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">📝 Word Rescue</h1>
          <p className="text-lg mb-2">Make words from falling letters!</p>
          <p className="text-sm opacity-80 mb-2">90 seconds per round - longer words = more points!</p>
          <p className="text-xs text-yellow-300 font-semibold mb-1">🤭 Big bonus for potty mouths!</p>
          <p className="text-xs text-blue-200">🔊 Turn on sound for the full experience!</p>
        </div>
        <button 
          onClick={startGame}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg transform transition hover:scale-105"
        >
          Start Playing
        </button>
      </div>
    );
  }

  if (gameState === 'roundEnd') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-400 to-pink-600 text-white p-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">🎉 Round Complete!</h1>
          <p className="text-3xl mb-4">Final Score: {score}</p>
          <p className="text-lg mb-6">Words Found: {wordsFound.length}</p>
          
          {wordsFound.length > 0 && (
            <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
              <h3 className="text-lg font-bold mb-2">Your Words:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {wordsFound.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="uppercase font-bold">{item.word}</span>
                    <span className="text-yellow-300">+{item.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto h-screen bg-gradient-to-b from-purple-400 to-blue-500 overflow-hidden">
      {/* Game Stats */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-30 text-white p-3 z-10">
        <div className="flex justify-between items-center text-sm">
          <span>Score: {score}</span>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative w-full h-full pt-16 pb-32">
        {/* Regular falling letters - made bigger */}
        {letters.map(letter => (
          <div
            key={letter.id}
            onClick={() => selectLetter(letter.id)}
            className={`absolute w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl cursor-pointer transform transition-all duration-200 ${
              letter.selected 
                ? 'bg-yellow-300 text-black scale-110 shadow-lg' 
                : 'bg-white text-black hover:scale-105 shadow-md'
            }`}
            style={{
              left: `${letter.x}px`,
              top: `${letter.y}px`,
            }}
          >
            {letter.letter}
          </div>
        ))}
        
        {/* Popping letters animation - made bigger */}
        {poppingLetters.map(letter => {
          const elapsed = Date.now() - letter.popTime;
          const progress = elapsed / 800; // 800ms animation
          const scale = 1 + (progress * 2); // Scale up to 3x
          const opacity = Math.max(0, 1 - progress); // Fade out
          
          return (
            <div
              key={`pop-${letter.id}`}
              className="absolute w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl pointer-events-none bg-gradient-to-r from-pink-400 to-purple-500 text-white"
              style={{
                left: `${letter.x}px`,
                top: `${letter.y}px`,
                transform: `scale(${scale})`,
                opacity: opacity,
                transition: 'none'
              }}
            >
              {letter.letter}
            </div>
          );
        })}

        {/* Score notifications */}
        {scoreNotifications.map(notification => {
          const elapsed = Date.now() - notification.showTime;
          const progress = elapsed / 1500; // 1500ms animation
          const yOffset = progress * 60; // Move up 60px
          const opacity = Math.max(0, 1 - progress); // Fade out
          
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
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                fontWeight: notification.isProfanity ? '900' : '700'
              }}
            >
              +{notification.score}{notification.isProfanity ? '!' : ''}
            </div>
          );
        })}
      </div>

      {/* Bottom Control Panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-40 text-white p-4">
        <div className="mb-3">
          <div className="text-center text-sm opacity-80 mb-2">Selected Word:</div>
          <div className="text-center text-xl font-bold min-h-8 bg-black bg-opacity-30 rounded px-3 py-1">
            {selectedLetters.map(l => l.letter).join('')}
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={submitWord}
            disabled={selectedLetters.length === 0 || isValidating}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg transition"
          >
            {isValidating ? 'Checking...' : 'Submit Word'}
          </button>
          <button
            onClick={clearSelection}
            disabled={selectedLetters.length === 0}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg transition"
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