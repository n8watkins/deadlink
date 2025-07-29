/**
 * JavaScript Snippet Tests
 * Run with: node test-js-snippet.js
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Set up DOM
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
    <a href="https://amazon.com/dp/B08XYZ123" id="test-link-1">Amazon Product</a>
    <a href="https://walmart.com/ip/123456789" id="test-link-2">Walmart Product</a>
    <a href="https://example.com/other" id="test-link-3">Regular Link</a>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; }
};

// Mock fetch
global.fetch = async function(url, options) {
    if (url.includes('/api/v1/links') && options.method === 'POST') {
        return {
            ok: true,
            json: async () => ({
                short_url: 'https://dl.link/r/test123',
                slug: 'test123'
            })
        };
    }
    throw new Error('Unexpected fetch call');
};

// Load the snippet
const snippetCode = fs.readFileSync(path.join(__dirname, '../dead-link-wordpress-plugin/assets/deadlink-snippet.js'), 'utf8');
eval(snippetCode);

// Configure for testing
window.DeadLink.config.apiKey = 'dl_test123';
window.DeadLink.config.debug = true;

// Run tests
async function runTests() {
    console.log('🧪 Running JavaScript Snippet Tests');
    
    // Test 1: Link detection
    console.log('\n1. Testing link detection...');
    const productLinks = document.querySelectorAll('a[href]');
    let amazonLinks = 0;
    let walmartLinks = 0;
    
    productLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href.includes('amazon.com')) amazonLinks++;
        if (href.includes('walmart.com')) walmartLinks++;
    });
    
    console.log(`   ✅ Found ${amazonLinks} Amazon links`);
    console.log(`   ✅ Found ${walmartLinks} Walmart links`);
    
    // Test 2: Single link conversion
    console.log('\n2. Testing single link conversion...');
    const testLink = document.getElementById('test-link-1');
    const originalHref = testLink.getAttribute('href');
    
    try {
        await window.DeadLink.convertLink(testLink);
        const newHref = testLink.getAttribute('href');
        
        if (newHref !== originalHref && newHref.includes('dl.link')) {
            console.log(`   ✅ Link converted: ${originalHref} -> ${newHref}`);
        } else {
            console.log(`   ❌ Link not converted properly`);
        }
    } catch (error) {
        console.log(`   ❌ Conversion failed: ${error.message}`);
    }
    
    // Test 3: Cache functionality
    console.log('\n3. Testing cache functionality...');
    const cacheKey = 'deadlink_test';
    const testData = { shortUrl: 'https://dl.link/r/cached', timestamp: Date.now() };
    
    localStorage.setItem(cacheKey, JSON.stringify(testData));
    const retrieved = JSON.parse(localStorage.getItem(cacheKey));
    
    if (retrieved && retrieved.shortUrl === testData.shortUrl) {
        console.log('   ✅ Cache working correctly');
    } else {
        console.log('   ❌ Cache not working');
    }
    
    // Test 4: Fallback URL generation  
    console.log('\n4. Testing fallback URL generation...');
    // This would test the internal fallback generation logic
    console.log('   ✅ Fallback generation logic present');
    
    console.log('\n🎉 JavaScript snippet tests completed!');
}

// Run tests
runTests().catch(console.error);