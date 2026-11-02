import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Dashboard Contrast and Accessibility Tests', () => {
  test('should not have contrast violations on dashboard page', async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/dashboard');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Run axe accessibility tests with specific focus on contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .withRules(['color-contrast'])
      .analyze();

    // Assert no contrast violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should check individual dashboard elements for contrast', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check specific elements that might have contrast issues
    const elementsToCheck = [
      'h1', // Main heading
      '.text-gray-500', // Secondary text
      '.text-gray-600', // Chart labels
      '.text-gray-400', // Placeholder text
      'button',
      'select',
      'table th',
      'table td',
    ];

    for (const selector of elementsToCheck) {
      const elements = await page.locator(selector).all();
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (await element.isVisible()) {
          // Get computed styles
          const styles = await element.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              fontSize: computed.fontSize,
            };
          });

          console.log(`Element ${selector}[${i}]:`, styles);
        }
      }
    }
  });

  test('should test dashboard with dark mode', async ({ page }) => {
    // Set dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Run contrast checks for dark mode
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .withRules(['color-contrast'])
      .analyze();

    // Log any violations for analysis
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Dark mode contrast violations:', accessibilityScanResults.violations);
    }
  });

  test('should check login page contrast', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should check analytics page contrast', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Analytics page contrast violations:', accessibilityScanResults.violations);
    }
  });
});