export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col text-white">
      <nav className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/" className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
            <span className="text-blue-500">Arch</span>Leet
          </a>
          <div className="flex items-center gap-4 text-sm font-medium">
            <a href="/problems" className="text-gray-300 hover:text-white transition-colors">Problems</a>
            <a href="/login" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md transition-colors">Sign In</a>
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>
      <footer className="border-t border-gray-800 py-6 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} ArchLeet. Master software architecture.</p>
      </footer>
    </div>
  );
}
