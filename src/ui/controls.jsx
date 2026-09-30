import React from 'react';

export function Slider({ label, value, min, max, step = 0.01, onChange, format, tip, showTip, unit }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="ctl">
      <span className="ctl-top">
        <span className="ctl-label">{label}</span>
        <output className="ctl-value">
          {format ? format(value) : value.toFixed(2)}
          {unit ? <small>{unit}</small> : null}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${Math.max(0, Math.min(100, pct))}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {showTip && tip ? <span className="ctl-tip">{tip}</span> : null}
    </label>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg-wrap">
      {label ? <span className="ctl-label">{label}</span> : null}
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, note }) {
  return (
    <button type="button" className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="toggle-track"><span className="toggle-knob" /></span>
      <span className="toggle-text">
        {label}
        {note ? <small>{note}</small> : null}
      </span>
    </button>
  );
}
