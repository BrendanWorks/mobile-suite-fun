import { useEffect, useRef } from 'react'

type SwipeDirection = 'up' | 'down' | 'left' | 'right'
type SwipeCallback = (direction: SwipeDirection) => void

export default function useSwipeControls(onSwipe: SwipeCallback) {
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 })
  const touchEndRef = useRef({ x: 0, y: 0, time: 0 })

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.changedTouches[0]
      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      }

      const deltaX = touchEndRef.current.x - touchStartRef.current.x
      const deltaY = touchEndRef.current.y - touchStartRef.current.y
      const deltaTime = touchEndRef.current.time - touchStartRef.current.time
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // Tap detection
      if (distance < 10 && deltaTime < 300) {
        onSwipe('up') // Treat tap as jump
        return
      }

      // Swipe detection
      if (distance > 30) {
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          // Vertical swipe
          if (deltaY < 0) {
            onSwipe('up')
          } else {
            onSwipe('down')
          }
        } else {
          // Horizontal swipe
          if (deltaX < 0) {
            onSwipe('left')
          } else {
            onSwipe('right')
          }
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
    }

    // Add event listeners to document for global touch handling
    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [onSwipe])
}