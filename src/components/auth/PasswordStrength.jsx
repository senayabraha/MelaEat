const getLevel = (pw) => {
  if (pw.length < 8) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  if (classes <= 1) return 1;
  if (classes === 2) return 2;
  return 3;
};

const LEVELS = [
  { color: '#ef4444', label: 'Too short' },
  { color: '#f97316', label: 'Weak' },
  { color: '#eab308', label: 'Fair' },
  { color: '#22c55e', label: 'Strong' },
];

export default function PasswordStrength({ password }) {
  if (!password) return null;
  const level = getLevel(password);
  const { color, label } = LEVELS[level];
  const filled = level + 1;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-200"
            style={{ background: i < filled ? color : '#e2e8f0' }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color }}>{label}</p>
    </div>
  );
}
