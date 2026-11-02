// Dashboard E2E testing script
const puppeteer = require('puppeteer');

async function testDashboard() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Testing Dashboard E2E...');
    
    // Navigate to dashboard
    await page.goto('http://localhost:3000');
    
    // Test login
    await page.waitForSelector('input[name="api-key"]');
    await page.type('input[name="api-key"]', 'dl_test123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForSelector('h1');
    const title = await page.$eval('h1', el => el.textContent);
    console.log(`✅ Logged in successfully: ${title}`);
    
    // Test navigation
    await page.click('a[href="/dashboard/links"]');
    await page.waitForSelector('h1');
    console.log('✅ Links page loaded');
    
    // Test link creation
    await page.click('button:contains("Add Link")');
    await page.waitForSelector('input[type="url"]');
    await page.type('input[type="url"]', 'https://example.com/test');
    await page.click('button[type="submit"]');
    console.log('✅ Link creation tested');
    
    // Test analytics page
    await page.click('a[href="/dashboard/analytics"]');
    await page.waitForSelector('h1');
    console.log('✅ Analytics page loaded');
    
    console.log('🎉 All dashboard tests passed!');
    
  } catch (error) {
    console.error('❌ Dashboard test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDashboard();
}

module.exports = { testDashboard };