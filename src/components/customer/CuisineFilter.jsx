import React from 'react';

const CUISINES = [
  { key: 'all', label: 'All' },
  { key: 'Ethiopian', label: 'Ethiopian' },
  { key: 'Italian', label: 'Italian' },
  { key: 'Burgers', label: 'Burgers' },
  { key: 'Pizza', label: 'Pizza' },
  { key: 'Vegan', label: 'Vegan' },
  { key: 'Drinks', label: 'Drinks' },
  { key: 'Desserts', label: 'Desserts' },
];

export default function CuisineFilter({ value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
      {CUISINES.map((c) => {
        const active = value === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              active
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-foreground border-border hover:border-foreground/40'
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}