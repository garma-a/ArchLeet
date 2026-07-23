"use client";

export function ProblemFilters({ defaultCategory, defaultDifficulty }: { defaultCategory?: string, defaultDifficulty?: string }) {
  return (
    <form method="get" action="/problems" className="flex gap-4">
      <select 
        name="difficulty" 
        defaultValue={defaultDifficulty || ""} 
        onChange={(e) => e.target.form?.submit()} 
        className="bg-gray-900 border border-gray-800 text-sm rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        <option value="">All Difficulties</option>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      <select 
        name="category" 
        defaultValue={defaultCategory || ""} 
        onChange={(e) => e.target.form?.submit()} 
        className="bg-gray-900 border border-gray-800 text-sm rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        <option value="">All Categories</option>
        <option value="solid">SOLID Principles</option>
        <option value="gof_creational">Creational Patterns</option>
        <option value="gof_structural">Structural Patterns</option>
        <option value="gof_behavioral">Behavioral Patterns</option>
        <option value="refactoring">Refactoring</option>
      </select>
    </form>
  );
}
