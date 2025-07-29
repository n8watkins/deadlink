/**
 * DeadLink Universal Snippet
 * Converts product links to DeadLink URLs on any website
 * Version 1.0.0
 */

(function() {
    'use strict';
    
    // Configuration - set these values
    const DEADLINK_CONFIG = {
        apiKey: '', // Set your API key here
        apiUrl: 'https://api.deadlink.io',
        targetDomains: [
            'amazon.com',
            'amazon.co.uk',
            'walmart.com',
            'target.com',
            'bestbuy.com',
            'ebay.com'
        ],
        autoConvert: true,
        cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        debug: false
    };
    
    // Initialize the snippet
    function init() {
        if (!DEADLINK_CONFIG.apiKey) {
            console.warn('DeadLink: API key not configured');
            return;
        }
        
        if (DEADLINK_CONFIG.autoConvert) {
            convertExistingLinks();
            observeNewLinks();
        }
        
        // Expose global API (without exposing config)
        window.DeadLink = {
            convertLink: convertSingleLink,
            convertAll: convertExistingLinks,
            setApiKey: function(key) { DEADLINK_CONFIG.apiKey = key; },
            setDebug: function(debug) { DEADLINK_CONFIG.debug = debug; }
        };
        
        if (DEADLINK_CONFIG.debug) {
            console.log('DeadLink snippet initialized');
        }
    }
    
    // Convert all existing links on the page
    function convertExistingLinks() {
        const links = findProductLinks();
        
        if (DEADLINK_CONFIG.debug) {
            console.log(`DeadLink: Found ${links.length} product links`);
        }
        
        links.forEach(link => {
            convertSingleLink(link);
        });
    }
    
    // Find all product links on the page
    function findProductLinks() {
        const allLinks = document.querySelectorAll('a[href]');
        const productLinks = [];
        
        allLinks.forEach(link => {
            const href = link.getAttribute('href');
            
            if (isProductLink(href) && !isDeadLink(href)) {
                productLinks.push(link);
            }
        });
        
        return productLinks;
    }
    
    // Check if URL is a product link
    function isProductLink(url) {
        if (!url || !url.startsWith('http')) {
            return false;
        }
        
        try {
            const urlObj = new URL(url);
            return DEADLINK_CONFIG.targetDomains.some(domain => {
                return urlObj.hostname.includes(domain);
            });
        } catch (e) {
            return false;
        }
    }
    
    // Check if URL is already a DeadLink
    function isDeadLink(url) {
        return url.includes('/r/') && url.includes('deadlink');
    }
    
    // Convert a single link element
    async function convertSingleLink(linkElement) {
        const originalUrl = linkElement.getAttribute('href');
        
        if (!originalUrl || !isProductLink(originalUrl)) {
            return false;
        }
        
        try {
            const shortUrl = await getOrCreateShortUrl(originalUrl);
            
            if (shortUrl) {
                linkElement.setAttribute('href', shortUrl);
                linkElement.setAttribute('data-deadlink-original', originalUrl);
                linkElement.classList.add('deadlink-converted');
                
                if (DEADLINK_CONFIG.debug) {
                    console.log(`DeadLink: Converted ${originalUrl} -> ${shortUrl}`);
                }
                
                return true;
            }
        } catch (error) {
            console.error('DeadLink conversion error:', error);
        }
        
        return false;
    }
    
    // Get short URL from cache or create new one
    async function getOrCreateShortUrl(url) {
        // Check cache first
        const cacheKey = `deadlink_${btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            const cachedData = JSON.parse(cached);
            const now = Date.now();
            
            if (now - cachedData.timestamp < DEADLINK_CONFIG.cacheTimeout) {
                return cachedData.shortUrl;
            }
        }
        
        // Create new short URL
        const shortUrl = await createShortUrl(url);
        
        if (shortUrl) {
            // Cache the result
            localStorage.setItem(cacheKey, JSON.stringify({
                shortUrl: shortUrl,
                timestamp: Date.now()
            }));
        }
        
        return shortUrl;
    }
    
    // Create short URL via API
    async function createShortUrl(url) {
        try {
            const fallbackUrls = generateFallbackUrls(url);
            
            const response = await fetch(`${DEADLINK_CONFIG.apiUrl}/api/v1/links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': DEADLINK_CONFIG.apiKey
                },
                body: JSON.stringify({
                    url: url,
                    fallback_urls: fallbackUrls
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            return data.short_url;
            
        } catch (error) {
            console.error('DeadLink API error:', error);
            return null;
        }
    }
    
    // Generate fallback URLs for a product
    function generateFallbackUrls(originalUrl) {
        const fallbacks = [];
        
        try {
            const url = new URL(originalUrl);
            const domain = url.hostname;
            
            // Amazon-specific fallbacks
            if (domain.includes('amazon')) {
                // Try to extract search terms from URL or title
                const searchTerms = extractSearchTerms(originalUrl);
                if (searchTerms) {
                    fallbacks.push(`https://${domain}/s?k=${encodeURIComponent(searchTerms)}`);
                }
                
                // Category fallback
                const categoryMatch = originalUrl.match(/\/([^\/]+)\/dp\//);
                if (categoryMatch) {
                    fallbacks.push(`https://${domain}/s?k=${encodeURIComponent(categoryMatch[1])}`);
                }
            }
            
            // Walmart-specific fallbacks
            else if (domain.includes('walmart')) {
                const searchTerms = extractSearchTerms(originalUrl);
                if (searchTerms) {
                    fallbacks.push(`https://${domain}/search?query=${encodeURIComponent(searchTerms)}`);
                }
            }
            
            // Generic homepage fallback
            fallbacks.push(`${url.protocol}//${domain}`);
            
        } catch (e) {
            // Ignore URL parsing errors
        }
        
        return fallbacks.filter(url => url).slice(0, 3); // Max 3 fallbacks
    }
    
    // Extract search terms from URL or page context
    function extractSearchTerms(url) {
        // Try to extract from URL parameters
        try {
            const urlObj = new URL(url);
            const keywords = urlObj.searchParams.get('keywords') || 
                           urlObj.searchParams.get('k') || 
                           urlObj.searchParams.get('query');
            
            if (keywords) {
                return keywords;
            }
        } catch (e) {
            // Ignore
        }
        
        // Try to extract from page title or product name
        const titleElement = document.querySelector('h1, .product-title, [data-product-title]');
        if (titleElement) {
            const title = titleElement.textContent.trim();
            // Extract first few meaningful words
            const words = title.split(/\s+/).slice(0, 3).join(' ');
            return words;
        }
        
        return null;
    }
    
    // Observe new links added to the page
    function observeNewLinks() {
        if (typeof MutationObserver === 'undefined') {
            return; // Not supported in older browsers
        }
        
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the node itself is a link
                        if (node.tagName === 'A' && node.hasAttribute('href')) {
                            convertSingleLink(node);
                        }
                        
                        // Check for links within the added node
                        const links = node.querySelectorAll ? node.querySelectorAll('a[href]') : [];
                        links.forEach(link => {
                            convertSingleLink(link);
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        if (DEADLINK_CONFIG.debug) {
            console.log('DeadLink: Observing new links');
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();

// CSS styles for converted links (optional)
const deadlinkStyles = `
.deadlink-converted {
    position: relative;
}

.deadlink-converted::after {
    content: "🔗";
    position: absolute;
    right: -15px;
    top: 0;
    font-size: 10px;
    opacity: 0.5;
}

.deadlink-converted:hover::after {
    opacity: 1;
}
`;

// Inject CSS
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = deadlinkStyles;
    document.head.appendChild(styleSheet);
}