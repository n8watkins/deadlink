'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { EyeIcon, EyeSlashIcon, ClipboardIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [showApiKey, setShowApiKey] = useState(false);
  const [settings, setSettings] = useState({
    blockBots: false,
    emailNotifications: true,
    webhookUrl: '',
  });

  const copyApiKey = async () => {
    if (!session?.user?.apiKey) return;
    
    try {
      await navigator.clipboard.writeText(session.user.apiKey);
      // Add toast notification here
    } catch (err) {
      console.error('Failed to copy API key:', err);
    }
  };

  const generateNewApiKey = async () => {
    if (!confirm('This will invalidate your current API key. Continue?')) return;
    
    // This would call your API to generate a new key
    alert('Feature not implemented yet');
  };

  const saveSettings = async () => {
    // This would save settings to your API
    alert('Settings saved (feature not fully implemented)');
  };

  if (status === 'loading') {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="space-y-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <div>Please log in to access settings.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-8">
        {/* Profile Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Profile</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your account information and plan details.
            </p>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{session?.user?.email}</p>
            </div>
            {session?.user?.name && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{session.user.name}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Plan</label>
              <p className="mt-1 text-sm text-gray-900 capitalize">{session?.user?.plan || 'Free'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Account Status</label>
              <p className="mt-1 text-sm text-gray-900">
                {session?.user?.emailVerified ? 'Verified' : 'Unverified'}
              </p>
            </div>
          </div>
        </div>

        {/* API Key Section */}
        {session?.user?.apiKey && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">API Key</h3>
              <p className="mt-1 text-sm text-gray-500">
                Use this key to authenticate API requests from your applications.
              </p>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={session.user.apiKey}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      {showApiKey ? (
                        <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={copyApiKey}
                  className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ClipboardIcon className="h-4 w-4 mr-1" />
                  Copy
                </button>
                <button
                  onClick={generateNewApiKey}
                  className="px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                >
                  Regenerate
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Keep your API key secure. Don't share it in publicly accessible areas.
              </p>
            </div>
          </div>
        )}

        {/* Link Settings */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Link Settings</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure how your links behave and what traffic to allow.
            </p>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Block Bot Traffic
                </label>
                <p className="text-sm text-gray-500">
                  Prevent known bots from accessing your links
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettings({...settings, blockBots: !settings.blockBots})}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  settings.blockBots ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.blockBots ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure how you want to be notified about link status changes.
            </p>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Email Notifications
                </label>
                <p className="text-sm text-gray-500">
                  Get notified when links go down or recover
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  settings.emailNotifications ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.emailNotifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook URL (optional)
              </label>
              <input
                type="url"
                value={settings.webhookUrl}
                onChange={(e) => setSettings({...settings, webhookUrl: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://your-app.com/webhook"
              />
              <p className="mt-1 text-sm text-gray-500">
                Receive HTTP notifications when link status changes
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}