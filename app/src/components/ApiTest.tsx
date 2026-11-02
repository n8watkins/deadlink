'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

export default function ApiTest() {
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState('');

  const testConnection = async () => {
    if (!apiKey) return;
    
    apiClient.setApiKey(apiKey);
    const response = await apiClient.getLinks(1, 5);
    
    setResult(JSON.stringify(response, null, 2));
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-bold mb-2">API Test</h3>
      <input
        type="text"
        placeholder="Enter API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="w-full p-2 border rounded mb-2"
      />
      <button
        onClick={testConnection}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Test Connection
      </button>
      <pre className="mt-4 p-2 bg-gray-100 rounded text-sm overflow-auto">
        {result}
      </pre>
    </div>
  );
}