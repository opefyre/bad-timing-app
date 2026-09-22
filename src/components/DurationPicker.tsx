'use client';

import { useEffect, useRef, useState } from 'react';

const PRESETS = [30, 45, 60, 90, 120, 180, 240, 360];

function label(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export default function DurationPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  function adjust(delta: number) {
    onChange(Math.min(12 * 60, Math.max(15, value + delta)));
  }

  return (
    <div className="custom-picker" ref={box}>
      <button type="button" className={`picker-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{label(value)}</span><b aria-hidden="true">▾</b>
      </button>
      {open && (
        <div className="picker-popover duration-popover">
          <div className="duration-presets">
            {PRESETS.map((minutes) => <button type="button" className={value === minutes ? 'selected' : ''} key={minutes} onClick={() => { onChange(minutes); setOpen(false); }}>{label(minutes)}</button>)}
          </div>
          <div className="duration-stepper">
            <button type="button" onClick={() => adjust(-15)} disabled={value <= 15}>−</button>
            <strong>{label(value)}</strong>
            <button type="button" onClick={() => adjust(15)} disabled={value >= 12 * 60}>+</button>
          </div>
        </div>
      )}
    </div>
  );
}
