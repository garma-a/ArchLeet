import { notFound } from 'next/navigation';
import { getProblemBySlug } from '@/actions/problems';
import { getSubmissionHistory } from '@/actions/submissions';
import { ProblemDetailClient } from './ProblemDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

// This is a Server Component — fetches data, then passes to client
export default async function ProblemPage({ params }: Props) {
  const { slug } = await params;
  const problem = await getProblemBySlug(slug);
  
  if (!problem) notFound();

  // Fetch history using problem.id (getSubmissionHistory expects problemId, not slug)
  const history = await getSubmissionHistory(problem.id);

  return <ProblemDetailClient problem={problem} submissionHistory={history || []} />;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const problem = await getProblemBySlug(slug);
  if (!problem) return {};
  return {
    title: `${problem.title} | ArchLeet`,
    description: `Solve a ${problem.difficulty} ${problem.category} architecture challenge.`,
  };
}
