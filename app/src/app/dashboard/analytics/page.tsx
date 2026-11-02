'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { apiClient, Link, Analytics } from '@/lib/api';

export default function AnalyticsPage() {
  const [selectedLink, setSelectedLink] = useState<string>('overview');
  const [timeRange, setTimeRange] = useState('30d');
  const [links, setLinks] = useState<Link[]>([]);
  const [analyticsData, setAnalyticsData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    const response = await apiClient.getLinks();
    if (response.data) {
      setLinks(response.data.links);
    }
  };

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    
    let response;
    if (selectedLink === 'overview') {
      response = await apiClient.getOverviewAnalytics(
        timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      );
    } else {
      response = await apiClient.getLinkAnalytics(
        selectedLink,
        timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      );
    }
    
    if (response.data) {
      setAnalyticsData(response.data);
    }
    
    setLoading(false);
  }, [selectedLink, timeRange]);

  useEffect(() => {
    fetchLinks();
  }, []);

  useEffect(() => {
    if (selectedLink) {
      fetchAnalytics();
    }
  }, [selectedLink, fetchAnalytics]);

  const handleExport = async () => {
    const response = await apiClient.exportAnalytics('csv', 
      timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    );
    
    if (response.data) {
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading analytics...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-sm text-gray-700">
            Detailed insights into your link performance and traffic patterns.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowDownTrayIcon className="-ml-1 mr-2 h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex space-x-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Link
          </label>
          <select
            value={selectedLink}
            onChange={(e) => setSelectedLink(e.target.value)}
            className="block w-64 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="overview">All Links</option>
            {links.map((link) => (
              <option key={link.slug} value={link.slug}>
                {link.slug} - {link.primary_url.substring(0, 40)}...
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Time Range
          </label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {analyticsData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Clicks
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {analyticsData.summary?.total_clicks?.toLocaleString() || '0'}
                </dd>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Human Clicks
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-green-600">
                  {analyticsData.summary?.human_clicks?.toLocaleString() || '0'}
                </dd>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Bot Clicks
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-red-600">
                  {analyticsData.summary?.bot_clicks?.toLocaleString() || '0'}
                </dd>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Countries
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-blue-600">
                  {analyticsData.summary?.unique_countries || '0'}
                </dd>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Daily Trends */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.daily || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="human_clicks"
                      stroke="#10B981"
                      strokeWidth={2}
                      name="Human"
                    />
                    <Line
                      type="monotone"
                      dataKey="bot_clicks"
                      stroke="#EF4444"
                      strokeWidth={2}
                      name="Bot"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Geographic Distribution */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Countries</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.geo_breakdown?.slice(0, 8) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="country" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="clicks" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Geographic Breakdown */}
            {analyticsData.geo_breakdown && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Geographic Breakdown</h3>
                </div>
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Country
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Clicks
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Visitors
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analyticsData.geo_breakdown.slice(0, 10).map((geo) => (
                        <tr key={geo.country}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {geo.country}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {geo.clicks.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {geo.unique_visitors?.toLocaleString() || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top Referrers */}
            {analyticsData.referrers && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Top Referrers</h3>
                </div>
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Domain
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Clicks
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analyticsData.referrers.slice(0, 10).map((ref, index: number) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {ref.referer_domain || 'Direct'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ref.human_clicks.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}