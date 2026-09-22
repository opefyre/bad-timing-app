'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function parseValue(value: string) {
  const [date, time = '00:00'] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return { year, month, day, hour, minute };
}

function compose(year: number, month: number, day: number, hour: number, minute: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function displayValue(value: string) {
  const p = parseValue(value);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export default function StartPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = useMemo(() => parseValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: selected.year, month: selected.month });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const firstDay = new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay();
  const mondayOffset = (firstDay + 6) % 7;
  const totalDays = daysInMonth(view.year, view.month);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - mondayOffset + 1;
    return day >= 1 && day <= totalDays ? day : null;
  });
  const monthLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(view.year, view.month - 1, 1)));

  function setDay(day: number) {
    onChange(compose(view.year, view.month, day, selected.hour, selected.minute));
  }

  function shiftTime(deltaMinutes: number) {
    const base = Date.UTC(selected.year, selected.month - 1, selected.day, selected.hour, selected.minute);
    const next = new Date(base + deltaMinutes * 60_000);
    onChange(compose(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), next.getUTCHours(), next.getUTCMinutes()));
  }

  function setToday() {
    const now = new Date();
    onChange(compose(now.getFullYear(), now.getMonth() + 1, now.getDate(), selected.hour, selected.minute));
    setView({ year: now.getFullYear(), month: now.getMonth() + 1 });
  }

  function toggle() {
    if (!open) setView({ year: selected.year, month: selected.month });
    setOpen(!open);
  }

  return (
    <div className="custom-picker" ref={box}>
      <button type="button" className={`picker-trigger ${open ? 'open' : ''}`} onClick={toggle} aria-expanded={open}>
        <span>{displayValue(value)}</span><b aria-hidden="true">▾</b>
      </button>
      {open && (
        <div className="picker-popover start-popover">
          <div className="calendar-head">
            <button type="button" onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))} aria-label="Previous month">←</button>
            <strong>{monthLabel}</strong>
            <button type="button" onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))} aria-label="Next month">→</button>
          </div>
          <div className="calendar-week"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>
          <div className="calendar-grid">
            {cells.map((day, index) => day ? (
              <button
                type="button"
                key={`${view.year}-${view.month}-${day}`}
                className={selected.year === view.year && selected.month === view.month && selected.day === day ? 'selected' : ''}
                onClick={() => setDay(day)}
              >{day}</button>
            ) : <span key={`blank-${index}`} />)}
          </div>
          <div className="time-stepper">
            <span>Time</span>
            <button type="button" onClick={() => shiftTime(-60)} aria-label="One hour earlier">−1h</button>
            <button type="button" onClick={() => shiftTime(-5)} aria-label="Five minutes earlier">−5m</button>
            <strong>{String(selected.hour).padStart(2, '0')}:{String(selected.minute).padStart(2, '0')}</strong>
            <button type="button" onClick={() => shiftTime(5)} aria-label="Five minutes later">+5m</button>
            <button type="button" onClick={() => shiftTime(60)} aria-label="One hour later">+1h</button>
          </div>
          <div className="picker-actions">
            <button type="button" className="picker-link" onClick={setToday}>Today</button>
            <button type="button" className="picker-done" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
