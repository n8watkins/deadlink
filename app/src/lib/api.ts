export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface Link {
  slug: string;
  primary_url: string;
  active_url: string;
  fallback_urls: string[];
  status: 'live' | 'dead' | 'fallback_1' | 'fallback_2' | 'paused';
  created_at: number;
  updated_at: number;
  clicks: number;
}

export interface Analytics {
  slug?: string;
  summary: {
    total_clicks: number;
    human_clicks: number;
    bot_clicks: number;
    unique_countries: number;
  };
  daily: Array<{
    date: string;
    human_clicks: number;
    bot_clicks: number;
    total_clicks: number;
  }>;
  geo_breakdown: Array<{
    country: string;
    clicks: number;
    unique_visitors: number;
  }>;
  referrers?: Array<{
    referer_domain: string;
    human_clicks: number;
  }>;
  totalLinks?: number;
  totalClicks?: number;
  humanClicks?: number;
  botClicks?: number;
  uniqueCountries?: number;
  dailyTrends?: Array<{
    date: string;
    human_clicks: number;
    bot_clicks: number;
  }>;
  topLinks?: Array<{
    slug: string;
    primary_url: string;
    human_clicks: number;
  }>;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      // Get NextAuth session token directly from cookies
      if (typeof window !== 'undefined') {
        // Client-side: extract session token from NextAuth cookies
        const sessionTokenName = process.env.NODE_ENV === 'production' 
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token';
        
        const sessionToken = document.cookie
          .split('; ')
          .find(row => row.startsWith(`${sessionTokenName}=`))
          ?.split('=')[1];
        
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }
      } else {
        // Server-side: get session token from cookies
        const { cookies } = await import('next/headers');
        const sessionTokenName = process.env.NODE_ENV === 'production' 
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token';
        
        const sessionToken = cookies().get(sessionTokenName)?.value;
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }
      }

      // Fallback to API key if no session token
      if (!headers['Authorization'] && this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for session auth
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: `${response.status}: ${errorText}` };
      }

      if (response.status === 204) {
        return { data: null as T };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Link management
  async createLink(url: string, fallbackUrls: string[] = []): Promise<ApiResponse<Link>> {
    return this.request<Link>('/api/v1/links', {
      method: 'POST',
      body: JSON.stringify({
        url,
        fallback_urls: fallbackUrls,
      }),
    });
  }

  async getLinks(page = 1, limit = 20): Promise<ApiResponse<{ links: Link[], total: number }>> {
    return this.request<{ links: Link[], total: number }>(`/api/v1/links?page=${page}&limit=${limit}`);
  }

  async getLink(slug: string): Promise<ApiResponse<Link>> {
    return this.request<Link>(`/api/v1/links/${slug}`);
  }

  async updateLink(slug: string, updates: Partial<Link>): Promise<ApiResponse<Link>> {
    return this.request<Link>(`/api/v1/links/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteLink(slug: string): Promise<ApiResponse<null>> {
    return this.request<null>(`/api/v1/links/${slug}`, {
      method: 'DELETE',
    });
  }

  // Analytics
  async getLinkAnalytics(slug: string, days = 30): Promise<ApiResponse<Analytics>> {
    return this.request<Analytics>(`/api/v1/analytics/link/${slug}?days=${days}`);
  }

  async getOverviewAnalytics(days = 30): Promise<ApiResponse<Analytics>> {
    return this.request<Analytics>(`/api/v1/analytics/overview?days=${days}`);
  }

  async exportAnalytics(format = 'csv', days = 30): Promise<ApiResponse<string>> {
    const response = await fetch(`${this.baseUrl}/api/v1/analytics/export?format=${format}&days=${days}`, {
      headers: this.apiKey ? { 'X-API-Key': this.apiKey } : {},
      credentials: 'include',
    });

    if (!response.ok) {
      return { error: `Export failed: ${response.statusText}` };
    }

    const data = await response.text();
    return { data };
  }
}

export const apiClient = new ApiClient();