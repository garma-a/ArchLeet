import Link from 'next/link';
import { getProblems } from '@/actions/problems';
import { DifficultyBadge } from '@/components/problems/DifficultyBadge';
import { CategoryTag } from '@/components/problems/CategoryTag';
import { ProblemFilters } from '@/components/problems/ProblemFilters';

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const problems = await getProblems({
    category: resolvedParams.category as any,
    difficulty: resolvedParams.difficulty as any,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Problems</h1>
          <p className="text-gray-400 mt-1">Select a problem to start refactoring.</p>
        </div>
        {/* Simple Filter UI */}
        <div className="flex gap-4">
          <ProblemFilters 
            defaultCategory={resolvedParams.category} 
            defaultDifficulty={resolvedParams.difficulty} 
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-950/50 text-gray-400 text-sm font-medium uppercase tracking-wider">
              <th className="p-4 w-12 text-center">Status</th>
              <th className="p-4">Title</th>
              <th className="p-4 w-32">Difficulty</th>
              <th className="p-4 hidden md:table-cell">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {problems.map((problem) => (
              <tr key={problem.id} className="hover:bg-gray-800/50 transition-colors group">
                <td className="p-4 text-center">
                  {problem.user_status === 'solved' ? (
                    <span className="text-green-500 font-bold" title="Solved">✓</span>
                  ) : problem.user_status === 'attempted' ? (
                    <span className="text-yellow-500 font-bold" title="Attempted">~</span>
                  ) : (
                    <span className="text-gray-600" title="Unseen">-</span>
                  )}
                </td>
                <td className="p-4">
                  <Link href={`/problems/${problem.slug}`} className="font-medium text-blue-400 hover:text-blue-300 hover:underline">
                    {problem.title}
                  </Link>
                </td>
                <td className="p-4">
                  <DifficultyBadge difficulty={problem.difficulty} />
                </td>
                <td className="p-4 hidden md:table-cell">
                  <CategoryTag category={problem.category} />
                </td>
              </tr>
            ))}
            {problems.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  No problems found. Try adjusting your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
