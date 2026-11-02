import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import Link from 'next/link';

export default async function HomePage() {
  const session = await getServerSession();
  
  // If user is authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard');
  }

  // For unauthenticated users, show simple welcome with login/signup
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Dead Links Switchboard
        </h1>
        <p className="text-gray-600 mb-8">
          Access your dashboard to manage links and view analytics.
        </p>
        
        <div className="space-y-4">
          <Link
            href="/login"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors block"
          >
            Sign In
          </Link>
          
          <Link
            href="/signup"
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors block"
          >
            Sign Up
          </Link>
        </div>
        
        <p className="text-sm text-gray-500 mt-6">
          New here?{' '}
          <a 
            href="https://deadlink.io" 
            className="text-blue-600 hover:text-blue-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more about Dead Links Switchboard
          </a>
        </p>
      </div>
    </main>
  );
}