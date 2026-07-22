import type { ProblemCategory } from '@/lib/types';

export function CategoryTag({ category }: { category: ProblemCategory }) {
  const label = category
    .replace('gof_', '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300 border border-gray-700 whitespace-nowrap">
      {label}
    </span>
  );
}
