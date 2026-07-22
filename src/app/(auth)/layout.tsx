export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-xl border border-gray-800 shadow-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}
