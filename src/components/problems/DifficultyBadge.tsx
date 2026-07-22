import type { Difficulty } from '@/lib/types';

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const styles = {
    easy:   'bg-green-500/10 text-green-500 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    hard:   'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${styles[difficulty]}`}>
      {difficulty}
    </span>
  );
}
