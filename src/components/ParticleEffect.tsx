import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface ParticleEffectProps {
  active: boolean;
  color: string;
  x: number;
  y: number;
}

export const ParticleEffect: React.FC<ParticleEffectProps> = ({ active, color, x, y }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const startX = x - rect.left;
    const startY = y - rect.top;

    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const velocity = 3 + Math.random() * 4;
      particlesRef.current.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 1,
        color: color,
      });
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let hasActiveParticles = false;
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life -= 0.05;
        if (p.life <= 0) return false;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;

        const alpha = Math.max(0, p.life);
        ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('rgb(', 'rgba(');
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();

        hasActiveParticles = true;
        return true;
      });

      if (hasActiveParticles) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [active, color, x, y]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      width={500}
      height={500}
    />
  );
};
