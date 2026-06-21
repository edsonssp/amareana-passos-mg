import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Cherry } from 'lucide-react';

const AnimatedBackground: React.FC = () => {
  const particles = useMemo(() => {
    const colors = [
      '#db322c', // amarena-red
      '#96121d', // amarena-dark-red
      '#43a447', // amarena-green
      '#822097', // amarena-purple
      '#f5981d', // amarena-orange
    ];
    
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      color: colors[i % colors.length],
      size: Math.random() * 12 + 6,
      initialX: Math.random() * 100,
      initialY: Math.random() * 100,
      duration: Math.random() * 25 + 15,
      delay: Math.random() * -25,
      isCherry: i % 4 === 0, // Every 4th particle is a cherry
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[-1]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ 
            left: `${p.initialX}%`, 
            top: `${p.initialY}%`, 
            opacity: 0 
          }}
          animate={{
            left: [
              `${p.initialX}%`, 
              `${(p.initialX + 25) % 100}%`, 
              `${(p.initialX - 25 + 100) % 100}%`, 
              `${p.initialX}%`
            ],
            top: [
              `${p.initialY}%`, 
              `${(p.initialY - 30 + 100) % 100}%`, 
              `${(p.initialY + 30) % 100}%`, 
              `${p.initialY}%`
            ],
            opacity: [0.4, 0.7, 0.4],
            rotate: p.isCherry ? [0, 360, 0] : 0,
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut"
          }}
          className="absolute"
          style={{ 
            width: p.size, 
            height: p.size,
          }}
        >
          {p.isCherry ? (
            <Cherry 
              size={p.size * 4} 
              className="text-amarena-red opacity-70 drop-shadow-2xl" 
            />
          ) : (
            <div 
              className="rounded-full blur-[5px]" 
              style={{ 
                backgroundColor: p.color, 
                width: '100%', 
                height: '100%',
                opacity: 0.7
              }} 
            />
          )}
        </motion.div>
      ))}
      
      {/* Subtle Gradient Overlay for depth */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{ 
          background: 'radial-gradient(circle at center, transparent 0%, rgba(255,255,255,0.2) 100%)'
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
