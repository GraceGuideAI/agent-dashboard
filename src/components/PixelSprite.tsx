'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type SpriteState = 'idle' | 'thinking' | 'executing' | 'complete';

const SUBAGENT_COLORS = [
  { body: '#10b981', outline: '#059669', accent: '#34d399' }, // emerald
  { body: '#f59e0b', outline: '#d97706', accent: '#fbbf24' }, // amber
  { body: '#ef4444', outline: '#dc2626', accent: '#f87171' }, // red
  { body: '#06b6d4', outline: '#0891b2', accent: '#22d3ee' }, // cyan
  { body: '#ec4899', outline: '#db2777', accent: '#f472b6' }, // pink
  { body: '#84cc16', outline: '#65a30d', accent: '#a3e635' }, // lime
];

function getColorForLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBAGENT_COLORS[Math.abs(hash) % SUBAGENT_COLORS.length];
}

// Pixel art operator sprite - lightning mage
function OperatorSprite({ state, frame }: { state: SpriteState; frame: number }) {
  const isWalking = state === 'executing';
  const legOffset = isWalking ? (frame % 2 === 0 ? 1 : -1) : 0;
  const bobOffset =
    state === 'idle' ? Math.sin(frame * 0.5) * 0.5 : state === 'thinking' ? Math.sin(frame * 0.8) * 1.2 : Math.sin(frame * 1.4) * 0.8;
  const armRaise = state === 'thinking' ? -3 : state === 'executing' ? (frame % 2 === 0 ? -1 : 0) : 0;
  const headTilt = state === 'thinking' ? Math.sin(frame * 0.6) * 1.5 : state === 'executing' ? (frame % 2 === 0 ? 1.5 : -1.5) : 0;

  return (
    <svg viewBox="0 0 16 24" className="w-full h-full" style={{ imageRendering: 'pixelated' }}>
      {/* Lightning aura when executing */}
      {state === 'executing' && (
        <>
          <rect x="3" y="2" width="1" height="2" fill="#fde047" opacity={frame % 2 ? 1 : 0.5} />
          <rect x="12" y="4" width="1" height="2" fill="#fde047" opacity={frame % 2 ? 0.5 : 1} />
          <rect x="1" y="8" width="1" height="1" fill="#a78bfa" opacity={frame % 3 ? 1 : 0} />
        </>
      )}

      {/* Thought bubble when thinking */}
      {state === 'thinking' && (
        <>
          <circle cx="13" cy="3" r="2" fill="#374151" />
          <circle cx="14" cy="5" r="1" fill="#374151" />
          <circle cx="12" cy="2" r="0.5" fill="#9ca3af" />
          <rect x="12" y="1" width="2" height="2" fill="#6b7280" />
        </>
      )}

      {/* Shadow */}
      <ellipse cx="8" cy="23" rx="4" ry="1" fill="#1e1b4b" opacity="0.5" />

      <g transform={`translate(0, ${bobOffset}) rotate(${headTilt} 8 10)`}>
        {/* Robe/Body - Purple wizard robe */}
        <rect x="5" y="10" width="6" height="8" fill="#7c3aed" />
        <rect x="4" y="12" width="1" height="5" fill="#7c3aed" />
        <rect x="11" y="12" width="1" height="5" fill="#7c3aed" />
        <rect x="5" y="18" width="2" height="2" fill="#5b21b6" />
        <rect x="9" y="18" width="2" height="2" fill="#5b21b6" />

        {/* Robe trim */}
        <rect x="5" y="17" width="6" height="1" fill="#c4b5fd" />

        {/* Belt with lightning buckle */}
        <rect x="5" y="13" width="6" height="1" fill="#1e1b4b" />
        <rect x="7" y="13" width="2" height="1" fill="#fde047" />

        {/* Head */}
        <rect x="5" y="4" width="6" height="6" fill="#fef3c7" />
        <rect x="4" y="5" width="1" height="4" fill="#fef3c7" />
        <rect x="11" y="5" width="1" height="4" fill="#fef3c7" />

        {/* Hair - spiky purple */}
        <rect x="4" y="3" width="2" height="2" fill="#6b21a8" />
        <rect x="6" y="2" width="2" height="2" fill="#6b21a8" />
        <rect x="8" y="1" width="2" height="3" fill="#6b21a8" />
        <rect x="10" y="2" width="2" height="3" fill="#6b21a8" />
        <rect x="5" y="4" width="6" height="1" fill="#6b21a8" />

        {/* Eyes */}
        <rect x="6" y="6" width="1" height="2" fill="#1e1b4b" />
        <rect x="9" y="6" width="1" height="2" fill="#1e1b4b" />
        {state === 'executing' && (
          <>
            <rect x="6" y="6" width="1" height="1" fill="#fde047" />
            <rect x="9" y="6" width="1" height="1" fill="#fde047" />
          </>
        )}

        {/* Mouth */}
        {state === 'complete' ? (
          <rect x="7" y="8" width="2" height="1" fill="#1e1b4b" />
        ) : (
          <rect x="7" y="8" width="1" height="1" fill="#1e1b4b" />
        )}

        {/* Arms */}
        <rect x="3" y={11 + armRaise} width="2" height="4" fill="#7c3aed" />
        <rect x="11" y={11 + armRaise} width="2" height="4" fill="#7c3aed" />
        {/* Hands */}
        <rect x="3" y={14 + armRaise} width="2" height="2" fill="#fef3c7" />
        <rect x="11" y={14 + armRaise} width="2" height="2" fill="#fef3c7" />

        {/* Staff with lightning crystal */}
        <rect x="1" y="8" width="1" height="10" fill="#92400e" />
        <rect x="0" y="6" width="3" height="3" fill="#a78bfa" />
        <rect x="1" y="5" width="1" height="2" fill="#fde047" />

        {/* Legs */}
        <rect x={6 + legOffset} y="20" width="2" height="2" fill="#4c1d95" />
        <rect x={8 - legOffset} y="20" width="2" height="2" fill="#4c1d95" />
        {/* Feet */}
        <rect x={5 + legOffset} y="22" width="3" height="1" fill="#1e1b4b" />
        <rect x={8 - legOffset} y="22" width="3" height="1" fill="#1e1b4b" />
      </g>

      {/* Complete sparkles */}
      {state === 'complete' && (
        <>
          <rect x="2" y="4" width="1" height="1" fill="#fde047" />
          <rect x="13" y="6" width="1" height="1" fill="#fde047" />
          <rect x="3" y="10" width="1" height="1" fill="#a78bfa" />
          <rect x="12" y="8" width="1" height="1" fill="#a78bfa" />
        </>
      )}
    </svg>
  );
}

// Pixel art worker sprite - little robot helper
function WorkerSprite({ state, frame, colors }: { state: SpriteState; frame: number; colors: typeof SUBAGENT_COLORS[0] }) {
  const isWalking = state === 'executing';
  const legOffset = isWalking ? (frame % 2 === 0 ? 1 : -1) : 0;
  const bobOffset =
    state === 'idle' ? Math.sin(frame * 0.5) * 0.4 : state === 'thinking' ? Math.sin(frame * 0.9) * 1 : Math.sin(frame * 1.6) * 0.7;
  const antennaWiggle = state === 'thinking' ? Math.sin(frame * 2.4) * 2.5 : state === 'executing' ? Math.sin(frame * 2.8) * 1.2 : 0;
  const bodyTilt = state === 'thinking' ? Math.sin(frame * 0.6) * 2 : state === 'executing' ? (frame % 2 === 0 ? 2 : -2) : 0;

  return (
    <svg viewBox="0 0 16 20" className="w-full h-full" style={{ imageRendering: 'pixelated' }}>
      {/* Working particles when executing */}
      {state === 'executing' && (
        <>
          <rect x="1" y={4 + (frame % 3)} width="1" height="1" fill={colors.accent} opacity={0.8} />
          <rect x="14" y={6 - (frame % 2)} width="1" height="1" fill={colors.accent} opacity={0.8} />
        </>
      )}

      {/* Thought bubble when thinking */}
      {state === 'thinking' && (
        <>
          <circle cx="13" cy="2" r="2" fill="#374151" />
          <circle cx="11" cy="4" r="1" fill="#374151" />
          <rect x="12" y="1" width="2" height="2" fill="#6b7280" />
        </>
      )}

      {/* Shadow */}
      <ellipse cx="8" cy="19" rx="3" ry="1" fill="#1e293b" opacity="0.5" />

      <g transform={`translate(0, ${bobOffset}) rotate(${bodyTilt} 8 9)`}>
        {/* Antenna */}
        <rect x={7 + antennaWiggle * 0.3} y="0" width="2" height="3" fill={colors.outline} />
        <rect x={6 + antennaWiggle * 0.5} y="0" width="1" height="1" fill={colors.accent} />
        <rect x={9 + antennaWiggle * 0.5} y="0" width="1" height="1" fill={colors.accent} />

        {/* Head - rounded robot */}
        <rect x="4" y="3" width="8" height="6" fill={colors.body} />
        <rect x="3" y="4" width="1" height="4" fill={colors.body} />
        <rect x="12" y="4" width="1" height="4" fill={colors.body} />
        <rect x="5" y="2" width="6" height="1" fill={colors.body} />

        {/* Face plate */}
        <rect x="5" y="4" width="6" height="4" fill="#1e293b" />

        {/* Eyes - LED style */}
        <rect x="5" y="5" width="2" height="2" fill={state === 'executing' ? colors.accent : '#fff'} />
        <rect x="9" y="5" width="2" height="2" fill={state === 'executing' ? colors.accent : '#fff'} />
        {state === 'executing' && frame % 2 === 0 && (
          <>
            <rect x="5" y="5" width="1" height="1" fill="#fff" />
            <rect x="9" y="5" width="1" height="1" fill="#fff" />
          </>
        )}

        {/* Mouth */}
        {state === 'complete' ? (
          <path d="M6 7 L8 8 L10 7" stroke={colors.accent} strokeWidth="0.5" fill="none" />
        ) : (
          <rect x="6" y="7" width="4" height="1" fill={state === 'thinking' ? colors.accent : '#64748b'} />
        )}

        {/* Body */}
        <rect x="5" y="9" width="6" height="5" fill={colors.body} />
        <rect x="4" y="10" width="1" height="3" fill={colors.body} />
        <rect x="11" y="10" width="1" height="3" fill={colors.body} />

        {/* Chest panel */}
        <rect x="6" y="10" width="4" height="3" fill={colors.outline} />
        <rect x="7" y="11" width="2" height="1" fill={state === 'executing' ? colors.accent : '#fff'} />

        {/* Arms */}
        <rect x="2" y="10" width="2" height="3" fill={colors.body} />
        <rect x="12" y="10" width="2" height="3" fill={colors.body} />
        {/* Hands/claws */}
        <rect x="2" y="13" width="2" height="1" fill={colors.outline} />
        <rect x="12" y="13" width="2" height="1" fill={colors.outline} />

        {/* Legs */}
        <rect x={5 + legOffset} y="14" width="2" height="3" fill={colors.outline} />
        <rect x={9 - legOffset} y="14" width="2" height="3" fill={colors.outline} />
        {/* Feet */}
        <rect x={4 + legOffset} y="17" width="3" height="2" fill={colors.body} />
        <rect x={9 - legOffset} y="17" width="3" height="2" fill={colors.body} />
      </g>

      {/* Complete sparkles */}
      {state === 'complete' && (
        <>
          <rect x="1" y="3" width="1" height="1" fill={colors.accent} />
          <rect x="14" y="5" width="1" height="1" fill={colors.accent} />
        </>
      )}
    </svg>
  );
}

// Walking animation container
export function PixelCharacter({
  isOperator,
  state,
  label = 'worker',
  containerWidth = 200,
}: {
  isOperator: boolean;
  state: SpriteState;
  label?: string;
  containerWidth?: number;
}) {
  const [frame, setFrame] = useState(0);
  const [position, setPosition] = useState({ x: 50, direction: 1 });
  const colors = getColorForLabel(label);

  // Animation frame counter
  useEffect(() => {
    const frameRate = state === 'executing' ? 90 : state === 'thinking' ? 160 : 480;
    const interval = setInterval(() => {
      setFrame((f) => f + 1);
    }, frameRate);
    return () => clearInterval(interval);
  }, [state]);

  // Walking movement
  useEffect(() => {
    if (state === 'executing') {
      const walkInterval = setInterval(() => {
        setPosition((prev) => {
          const speed = 12;
          let newX = prev.x + speed * prev.direction;
          let newDir = prev.direction;

          // Bounce off walls
          if (newX > containerWidth - 50) {
            newX = containerWidth - 50;
            newDir = -1;
          } else if (newX < 10) {
            newX = 10;
            newDir = 1;
          }

          return { x: newX, direction: newDir };
        });
      }, 200);
      return () => clearInterval(walkInterval);
    } else if (state === 'thinking') {
      // Pacing back and forth in smaller area
      const paceInterval = setInterval(() => {
        setPosition((prev) => {
          const speed = 6;
          const newX = prev.x + speed * prev.direction;
          let newDir = prev.direction;

          // Smaller pacing range
          const center = containerWidth / 2;
          if (newX > center + 40) {
            newDir = -1;
          } else if (newX < center - 40) {
            newDir = 1;
          }

          return { x: newX, direction: newDir };
        });
      }, 240);
      return () => clearInterval(paceInterval);
    } else {
      // Return to center when idle
      setPosition((prev) => ({ x: containerWidth / 2 - 20, direction: prev.direction }));
    }
  }, [state, containerWidth]);

  const spriteSize = isOperator ? 64 : 48;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <motion.div
        className="absolute bottom-0"
        animate={{ x: position.x }}
        transition={{ type: 'tween', duration: 0.2 }}
        style={{
          width: spriteSize,
          height: spriteSize * (isOperator ? 1.5 : 1.25),
          transform: `scaleX(${position.direction})`,
        }}
      >
        <motion.div
          animate={
            state === 'thinking'
              ? { y: [0, -6, 0], rotate: [-3, 3, -3], scale: [1, 1.04, 1] }
              : state === 'executing'
              ? { y: [0, -4, 0], rotate: [0, 2, -2, 0], scale: [1, 1.03, 1] }
              : { y: [0, -2, 0] }
          }
          transition={{
            duration: state === 'executing' ? 0.6 : state === 'thinking' ? 1.1 : 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: 'bottom center' }}
        >
          {isOperator ? (
            <OperatorSprite state={state} frame={frame} />
          ) : (
            <WorkerSprite state={state} frame={frame} colors={colors} />
          )}
        </motion.div>
      </motion.div>

      {/* Ground line decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
    </div>
  );
}

// Desk sprite for executing state
export function DeskSprite() {
  return (
    <svg viewBox="0 0 32 16" className="w-16 h-8" style={{ imageRendering: 'pixelated' }}>
      {/* Desk surface */}
      <rect x="0" y="6" width="32" height="2" fill="#78716c" />
      <rect x="2" y="8" width="2" height="8" fill="#57534e" />
      <rect x="28" y="8" width="2" height="8" fill="#57534e" />
      {/* Monitor */}
      <rect x="12" y="0" width="8" height="6" fill="#1e293b" />
      <rect x="13" y="1" width="6" height="4" fill="#3b82f6" />
      <rect x="15" y="6" width="2" height="1" fill="#374151" />
      {/* Keyboard */}
      <rect x="10" y="7" width="12" height="2" fill="#374151" />
    </svg>
  );
}
