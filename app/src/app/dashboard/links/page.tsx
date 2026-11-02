'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, PencilIcon, ClipboardIcon } from '@heroicons/react/24/outline';
import { apiClient, Link } from '@/lib/api';

export default function LinksPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    setLoading(true);
    const response = await apiClient.getLinks();
    if (response.data) {
      setLinks(response.data.links);
    }
    setLoading(false);
  };

  const handleDeleteLink = async (slug: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return;
    
    const response = await apiClient.deleteLink(slug);
    if (response.data !== undefined) {
      setLinks(links.filter(link => link.slug !== slug));
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-100 text-green-800';
      case 'dead': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="sm:flex sm:items-center mb-8">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Links</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your shortened links and their fallback URLs.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="-ml-1 mr-2 h-4 w-4" />
            Add Link
          </button>
        </div>
      </div>

      {/* Links Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {links.map((link) => (
            <li key={link.slug}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(link.status)}`}>
                      {link.status}
                    </span>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {link.primary_url}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <code className="bg-gray-100 px-2 py-1 rounded mr-4">
                      /r/{link.slug}
                    </code>
                    <span>{link.clicks} clicks</span>
                    <span className="ml-4">
                      Created {new Date(link.created_at * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/r/${link.slug}`)}
                    className="text-gray-400 hover:text-gray-500"
                    title="Copy short URL"
                  >
                    <ClipboardIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setEditingLink(link)}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="Edit link"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteLink(link.slug)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete link"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Create Link Modal */}
      {showCreateModal && (
        <CreateLinkModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchLinks();
          }}
        />
      )}

      {/* Edit Link Modal */}
      {editingLink && (
        <EditLinkModal
          link={editingLink}
          onClose={() => setEditingLink(null)}
          onSuccess={() => {
            setEditingLink(null);
            fetchLinks();
          }}
        />
      )}
    </div>
  );
}

// Create Link Modal Component
function CreateLinkModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [url, setUrl] = useState('');
  const [fallbackUrls, setFallbackUrls] = useState(['']);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const response = await apiClient.createLink(
      url,
      fallbackUrls.filter(u => u.trim())
    );

    if (response.data) {
      onSuccess();
    } else {
      alert(response.error);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Link</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary URL
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://example.com/product"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fallback URLs (optional)
            </label>
            {fallbackUrls.map((fallback, index) => (
              <input
                key={index}
                type="url"
                value={fallback}
                onChange={(e) => {
                  const newFallbacks = [...fallbackUrls];
                  newFallbacks[index] = e.target.value;
                  setFallbackUrls(newFallbacks);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                placeholder="https://alternative.com/product"
              />
            ))}
            <button
              type="button"
              onClick={() => setFallbackUrls([...fallbackUrls, ''])}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              + Add another fallback
            </button>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Link Modal Component  
function EditLinkModal({ link, onClose, onSuccess }: { link: Link; onClose: () => void; onSuccess: () => void }) {
  const [status, setStatus] = useState(link.status);
  const [fallbackUrls, setFallbackUrls] = useState(link.fallback_urls || ['']);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const response = await apiClient.updateLink(link.slug, {
      status,
      fallback_urls: fallbackUrls.filter(u => u.trim())
    });

    if (response.data) {
      onSuccess();
    } else {
      alert(response.error);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Link</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary URL (read-only)
            </label>
            <input
              type="url"
              value={link.primary_url}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Link['status'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="live">Live</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fallback URLs
            </label>
            {fallbackUrls.map((fallback, index) => (
              <div key={index} className="flex mb-2">
                <input
                  type="url"
                  value={fallback}
                  onChange={(e) => {
                    const newFallbacks = [...fallbackUrls];
                    newFallbacks[index] = e.target.value;
                    setFallbackUrls(newFallbacks);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://alternative.com/product"
                />
                {fallbackUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFallbackUrls(fallbackUrls.filter((_, i) => i !== index))}
                    className="ml-2 text-red-600 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFallbackUrls([...fallbackUrls, ''])}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              + Add fallback
            </button>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}