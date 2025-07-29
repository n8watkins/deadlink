# Dead-Link Switchboard: Phased Implementation Plan

## Phase 0: Foundation & Infrastructure (½ day)

### Goals
- Set up development environment
- Establish CI/CD pipeline
- Configure core infrastructure

### Tasks
```bash
# 1. Initialize repository
git init dead-link-switchboard
cd dead-link-switchboard
npm init -y

# 2. Install Cloudflare Wrangler
npm install -D wrangler @cloudflare/workers-types

# 3. Configure wrangler.toml
name = "dead-link-switchboard"
main = "src/index.js"
compatibility_date = "2024-01-01"

# 4. Set up GitHub Actions
.github/workflows/deploy.yml
```

### Testing Checkpoint
- [ ] `wrangler dev` runs locally
- [ ] CI pipeline deploys hello-world worker
- [ ] Secrets can be set: `wrangler secret put API_KEY`

### Exit Criteria
✅ Green CI build on PR merge

---

## Phase 1: Edge Redirect MVP (1 day)

### Goal
Build the core redirect worker that handles `/r/:slug` requests

### Implementation
```javascript
// src/redirect.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = url.pathname.split('/').pop();
    
    if (!slug) {
      return new Response('Not Found', { status: 404 });
    }
    
    const linkData = await env.LINKS.get(slug, 'json');
    if (!linkData) {
      return Response.redirect('https://yoursite.com/404', 302);
    }
    
    // Log click asynchronously
    request.waitUntil(
      env.ANALYTICS.writeDataPoint({
        blobs: [slug],
        doubles: [Date.now()]
      })
    );
    
    return Response.redirect(linkData.active_url, 302);
  }
}
```

### Testing Plan
1. **Unit Tests** (Vitest)
   ```javascript
   test('valid slug returns 302', async () => {
     const response = await worker.fetch('/r/abc123');
     expect(response.status).toBe(302);
   });
   ```

2. **Manual Testing**
   ```bash
   # Add test data to KV
   wrangler kv:key put --binding=LINKS "test123" '{"active_url":"https://example.com"}'
   
   # Test redirect
   curl -I http://localhost:8787/r/test123
   ```

3. **Staging Deploy**
   ```bash
   wrangler deploy --env staging
   ```

### Exit Criteria
✅ Live redirect works: Share a link with someone and confirm it redirects

---

## Phase 2: Link Registry API (2 days)

### Goals
- Build API to create/manage links
- Add authentication
- Store data in KV and D1

### Implementation Tasks
1. **Create Links API Worker**
   ```javascript
   // src/api.js
   import { nanoid } from 'nanoid';
   
   async function createLink(request, env) {
     const { url, fallback_urls, affiliate_tag } = await request.json();
     
     // Validate JWT
     const auth = await validateAuth(request.headers.get('Authorization'));
     if (!auth) return new Response('Unauthorized', { status: 401 });
     
     // Generate slug
     const slug = nanoid(6);
     
     // Store in KV
     const linkData = {
       slug,
       primary_url: url,
       fallback_urls: fallback_urls || [],
       active_url: url,
       status: 'live',
       owner_id: auth.userId,
       created_at: Date.now()
     };
     
     await env.LINKS.put(slug, JSON.stringify(linkData));
     
     // Store metadata in D1
     await env.DB.prepare(
       'INSERT INTO links (slug, owner_id, created_at) VALUES (?, ?, ?)'
     ).bind(slug, auth.userId, Date.now()).run();
     
     return Response.json({
       short_url: `https://dl.link/r/${slug}`,
       slug
     });
   }
   ```

2. **Set up D1 Database**
   ```sql
   -- schema.sql
   CREATE TABLE links (
     slug TEXT PRIMARY KEY,
     owner_id TEXT NOT NULL,
     created_at INTEGER,
     clicks INTEGER DEFAULT 0
   );
   
   CREATE TABLE users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE,
     plan TEXT DEFAULT 'free'
   );
   ```

### Testing Plan
1. **API Contract Tests**
   ```javascript
   // Postman/Newman collection
   {
     "name": "Create Link",
     "request": {
       "method": "POST",
       "url": "{{base_url}}/links",
       "headers": {
         "Authorization": "Bearer {{jwt}}"
       },
       "body": {
         "url": "https://amazon.com/dp/B123",
         "affiliate_tag": "mysite-20"
       }
     },
     "tests": [
       "pm.response.to.have.status(200)",
       "pm.response.to.have.jsonBody('short_url')"
     ]
   }
   ```

2. **Integration Tests**
   ```bash
   # GitHub Action
   - name: Test API
     run: |
       npm run test:integration
       newman run postman-collection.json
   ```

### Exit Criteria
✅ Can create a link via API and immediately redirect through it

---

## Phase 3: Health Checks & Failover (3 days)

### Goal
Implement automatic detection of dead links and failover to alternatives

### Implementation
```javascript
// src/health-check.js
export default {
  async scheduled(event, env, ctx) {
    const links = await env.LINKS.list({ limit: 100 });
    
    for (const { name: slug } of links.keys) {
      ctx.waitUntil(checkLink(slug, env));
    }
  }
};

async function checkLink(slug, env) {
  const data = await env.LINKS.get(slug, 'json');
  
  try {
    const response = await fetch(data.primary_url, {
      method: 'HEAD',
      redirect: 'manual'
    });
    
    const isDead = response.status >= 400 || 
                   response.status === 302; // Often indicates out-of-stock
    
    if (isDead && data.fallback_urls.length > 0) {
      // Switch to first fallback
      data.active_url = data.fallback_urls[0];
      data.status = 'fallback';
    } else if (!isDead && data.status !== 'live') {
      // Restore primary if back online
      data.active_url = data.primary_url;
      data.status = 'live';
    }
    
    data.last_checked = Date.now();
    await env.LINKS.put(slug, JSON.stringify(data));
    
  } catch (error) {
    console.error(`Failed to check ${slug}:`, error);
  }
}
```

### Testing Plan
1. **Unit Tests**
   ```javascript
   test('marks link as dead on 404', async () => {
     mockFetch.mockResolvedValue({ status: 404 });
     await checkLink('test123', mockEnv);
     
     const updated = await mockEnv.LINKS.get('test123', 'json');
     expect(updated.status).toBe('fallback');
   });
   ```

2. **Staging Test**
   - Create test link pointing to controllable endpoint
   - Make endpoint return 404
   - Wait for cron run
   - Verify redirect now goes to fallback

3. **Chaos Testing**
   ```bash
   # Simulate primary coming back online
   # Verify automatic restoration
   ```

### Exit Criteria
✅ Dead link automatically fails over within 10 minutes

---

## Phase 4: Analytics & Bot Protection (2 days)

### Goals
- Track clicks with Analytics Engine
- Filter bot traffic
- Provide basic reporting

### Implementation
```javascript
// Enhanced redirect.js
const BOT_UA_REGEX = /bot|crawler|spider|scraper/i;

export default {
  async fetch(request, env) {
    // ... existing code ...
    
    // Bot detection
    const userAgent = request.headers.get('User-Agent') || '';
    const isBot = BOT_UA_REGEX.test(userAgent);
    
    // Enhanced analytics
    request.waitUntil(
      env.ANALYTICS.writeDataPoint({
        blobs: [
          slug,
          linkData.status,
          isBot ? 'bot' : 'human'
        ],
        doubles: [
          Date.now(),
          request.cf?.latitude || 0,
          request.cf?.longitude || 0
        ]
      })
    );
    
    return Response.redirect(linkData.active_url, 302);
  }
}
```

### Testing Plan
1. **Load Testing**
   ```bash
   # Autocannon load test
   autocannon -c 50 -d 30 https://staging.dl.link/r/test123
   
   # Verify P99 < 5ms
   ```

2. **Analytics Verification**
   ```sql
   -- Query Analytics Engine
   SELECT 
     blob1 as slug,
     COUNT(*) as clicks,
     SUM(CASE WHEN blob3 = 'bot' THEN 1 ELSE 0 END) as bot_clicks
   FROM ANALYTICS
   WHERE timestamp > NOW() - INTERVAL 1 HOUR
   GROUP BY blob1
   ```

### Exit Criteria
✅ Dashboard shows real-time click counts with bot filtering

---

## Phase 5: Publisher Dashboard (4 days)

### Goals
- Web UI for link management
- CSV import functionality
- Real-time status updates

### Implementation
```javascript
// pages/dashboard.jsx (Next.js on CF Pages)
export default function Dashboard() {
  const { data: links } = useSWR('/api/links');
  
  return (
    <div>
      <h1>Your Links</h1>
      <LinkTable links={links} />
      <AddLinkForm />
      <CSVImporter />
    </div>
  );
}

// CSV Import Worker
async function handleCSVUpload(request, env) {
  const formData = await request.formData();
  const file = formData.get('csv');
  const content = await file.text();
  
  const rows = parseCSV(content);
  const results = [];
  
  for (const row of rows) {
    const slug = nanoid(6);
    await env.LINKS.put(slug, JSON.stringify({
      primary_url: row.url,
      fallback_urls: row.fallbacks?.split('|') || [],
      // ... other fields
    }));
    results.push({ original: row.url, short: `/r/${slug}` });
  }
  
  return Response.json({ imported: results.length, results });
}
```

### Testing Plan
1. **E2E Tests (Playwright)**
   ```javascript
   test('can add link via form', async ({ page }) => {
     await page.goto('/dashboard');
     await page.fill('#url', 'https://example.com/product');
     await page.click('button[type="submit"]');
     
     await expect(page.locator('.link-table')).toContainText('example.com');
   });
   ```

2. **Accessibility Testing**
   ```bash
   npm run test:a11y
   ```

### Exit Criteria
✅ Non-technical user can add links and view stats

---

## Phase 6: WordPress/CMS Plugins (3 days)

### Goals
- WordPress plugin for automatic link conversion
- JavaScript snippet for any CMS

### Implementation
```php
// wordpress-plugin/dead-link-switchboard.php
class DeadLinkSwitchboard {
    public function scan_content($content) {
        // Find all product links
        preg_match_all('/<a[^>]+href="([^"]+)"[^>]*>/', $content, $matches);
        
        foreach ($matches[1] as $url) {
            if ($this->is_product_url($url)) {
                $short_url = $this->create_short_link($url);
                $content = str_replace($url, $short_url, $content);
            }
        }
        
        return $content;
    }
    
    private function create_short_link($url) {
        $response = wp_remote_post('https://api.dl.link/links', [
            'headers' => ['Authorization' => 'Bearer ' . get_option('dls_api_key')],
            'body' => json_encode(['url' => $url])
        ]);
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        return $data['short_url'] ?? $url;
    }
}
```

### Testing Plan
1. **WordPress Docker Test**
   ```bash
   docker-compose up -d wordpress
   # Install plugin
   # Create test posts
   # Verify link conversion
   ```

2. **Rollback Test**
   - Deactivate plugin
   - Verify original links restored

### Exit Criteria
✅ Publisher successfully converts 100+ links via plugin

---

## Phase 7: Billing & Monetization (2 days)

### Goals
- Usage-based billing with Stripe
- Plan enforcement

### Implementation
```javascript
// Billing middleware
async function checkQuota(request, env, linkData) {
  const usage = await env.DB.prepare(
    'SELECT COUNT(*) as clicks FROM analytics WHERE slug = ? AND month = ?'
  ).bind(linkData.slug, getCurrentMonth()).first();
  
  const user = await env.DB.prepare(
    'SELECT plan, click_limit FROM users WHERE id = ?'
  ).bind(linkData.owner_id).first();
  
  if (usage.clicks > user.click_limit) {
    return Response.redirect('https://dl.link/upgrade', 402);
  }
}

// Stripe webhook handler
async function handleStripeWebhook(request, env) {
  const event = await verifyStripeSignature(request);
  
  switch (event.type) {
    case 'invoice.payment_succeeded':
      await upgradeUser(event.data.object.customer, 'pro');
      break;
    case 'customer.subscription.deleted':
      await downgradeUser(event.data.object.customer, 'free');
      break;
  }
}
```

### Testing Plan
1. **Stripe Test Mode**
   - Create test subscription
   - Verify webhook updates user plan
   - Test quota enforcement

### Exit Criteria
✅ Complete billing flow works in test mode

---

## Phase 8: Production Hardening (1 week)

### Goals
- Performance optimization
- Monitoring & alerting
- Security hardening

### Checklist
- [ ] KV read caching with proper headers
- [ ] Rate limiting on API endpoints
- [ ] Cloudflare Turnstile on public forms
- [ ] Logpush to BigQuery for analytics
- [ ] Synthetic monitoring from 5 regions
- [ ] Error budget and SLO definition
- [ ] GDPR compliance for click tracking
- [ ] Terms of Service and Privacy Policy

### Production Tests
1. **Canary Deployment**
   ```javascript
   // 5% traffic split
   if (Math.random() < 0.05) {
     return handleV2(request);
   }
   ```

2. **Chaos Engineering**
   - Random 404 injection
   - KV read failures
   - High latency simulation

### Launch Criteria
✅ 24 hours of clean canary metrics
✅ Load test at 2x expected traffic
✅ All security scans pass

---

## Post-Launch Continuous Testing

### Weekly
- Chaos drill: Random link failures
- Performance regression tests
- Security dependency updates

### Monthly
- Load test with increased limits
- Analytics accuracy audit
- Cost optimization review

### Quarterly
- Disaster recovery drill
- Full system audit
- Feature usage analysis