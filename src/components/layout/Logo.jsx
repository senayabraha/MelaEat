import React from 'react';
import { Link } from 'react-router-dom';

export default function Logo({ size = 'md', linkTo = '/' }) {
  const sizes = {
    sm: { box: 'w-8 h-8', text: 'text-lg' },
    md: { box: 'w-10 h-10', text: 'text-xl' },
    lg: { box: 'w-12 h-12', text: 'text-2xl' },
  };
  const s = sizes[size];
  const inner = (
    <div className="flex items-center gap-2.5">
      <div className={`${s.box} rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold shadow-sm`}>
        <span className="text-base">M</span>
      </div>
      <div className={`font-display font-bold ${s.text} tracking-tight text-foreground`}>
        MelaEat
      </div>
    </div>
  );
  if (linkTo) {
    return <Link to={linkTo}>{inner}</Link>;
  }
  return inner;
}