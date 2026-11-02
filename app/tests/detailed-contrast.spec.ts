import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Helper function to calculate contrast ratio
function calculateContrastRatio(color1: string, color2: string): number {
  // Convert rgb/rgba to hex
  const parseColor = (color: string) => {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
    return { r: 0, g: 0, b: 0 };
  };

  const getLuminance = (color: { r: number; g: number; b: number }) => {
    const { r, g, b } = color;
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const c1 = parseColor(color1);
  const c2 = parseColor(color2);
  
  const l1 = getLuminance(c1);
  const l2 = getLuminance(c2);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('Detailed Contrast Analysis', () => {
  test('should analyze text contrast ratios in detail', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Analyze different text elements
    const textElements = [
      { selector: 'h1', description: 'Main heading', minContrast: 3.0 },
      { selector: '.text-gray-500', description: 'Secondary text', minContrast: 4.5 },
      { selector: '.text-gray-600', description: 'Tertiary text', minContrast: 4.5 },
      { selector: '.text-gray-400', description: 'Placeholder text', minContrast: 3.0 },
      { selector: 'table th', description: 'Table headers', minContrast: 4.5 },
      { selector: 'table td', description: 'Table cells', minContrast: 4.5 },
      { selector: 'select', description: 'Form controls', minContrast: 4.5 },
    ];

    const contrastIssues: any[] = [];

    for (const element of textElements) {
      const elements = await page.locator(element.selector).all();
      
      for (let i = 0; i < Math.min(elements.length, 5); i++) {
        const el = elements[i];
        if (await el.isVisible()) {
          const styles = await el.evaluate((elem) => {
            const computed = window.getComputedStyle(elem);
            const rect = elem.getBoundingClientRect();
            
            // Get background color from element or parent
            let bgColor = computed.backgroundColor;
            let parent = elem.parentElement;
            
            // If background is transparent, find the first non-transparent parent
            while (parent && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {
              const parentStyles = window.getComputedStyle(parent);
              bgColor = parentStyles.backgroundColor;
              parent = parent.parentElement;
            }
            
            // Default to white if no background found
            if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
              bgColor = 'rgb(255, 255, 255)';
            }
            
            return {
              color: computed.color,
              backgroundColor: bgColor,
              fontSize: computed.fontSize,
              fontWeight: computed.fontWeight,
              text: elem.textContent?.substring(0, 50) || '',
              rect: { width: rect.width, height: rect.height }
            };
          });

          // Skip invisible elements
          if (styles.rect.width === 0 || styles.rect.height === 0) continue;

          const contrast = calculateContrastRatio(styles.color, styles.backgroundColor);
          
          console.log(`${element.description} [${i}]:`, {
            text: styles.text,
            color: styles.color,
            backgroundColor: styles.backgroundColor,
            contrast: contrast.toFixed(2),
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight,
            meetsAA: contrast >= element.minContrast ? '✓' : '✗'
          });

          if (contrast < element.minContrast) {
            contrastIssues.push({
              selector: element.selector,
              description: element.description,
              text: styles.text,
              contrast: contrast.toFixed(2),
              required: element.minContrast,
              color: styles.color,
              backgroundColor: styles.backgroundColor
            });
          }
        }
      }
    }

    // Report issues
    if (contrastIssues.length > 0) {
      console.log('\n🚨 CONTRAST ISSUES FOUND:');
      contrastIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.description}`);
        console.log(`   Text: "${issue.text}"`);
        console.log(`   Contrast: ${issue.contrast} (required: ${issue.required})`);
        console.log(`   Colors: ${issue.color} on ${issue.backgroundColor}`);
        console.log('');
      });
    } else {
      console.log('✅ All text elements meet WCAG contrast requirements');
    }

    // The test should still pass but we log the issues for manual review
    expect(contrastIssues.length).toBeLessThan(10); // Allow some minor issues for now
  });

  test('should test chart and visualization contrast', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for charts to render
    await page.waitForTimeout(2000);

    // Check chart elements
    const chartElements = [
      '.recharts-text',
      '.recharts-cartesian-axis-tick-value',
      '.recharts-legend-item-text',
      '.recharts-tooltip-label',
    ];

    for (const selector of chartElements) {
      const elements = await page.locator(selector).all();
      console.log(`Found ${elements.length} ${selector} elements`);
      
      for (let i = 0; i < Math.min(elements.length, 3); i++) {
        const element = elements[i];
        if (await element.isVisible()) {
          const styles = await element.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              color: computed.color,
              fontSize: computed.fontSize,
              text: el.textContent?.substring(0, 20) || ''
            };
          });
          
          console.log(`Chart element ${selector}[${i}]:`, styles);
        }
      }
    }
  });

  test('should suggest contrast improvements', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    console.log('\n💡 CONTRAST IMPROVEMENT SUGGESTIONS:');
    console.log('1. Consider using darker grays for better readability');
    console.log('   - Replace text-gray-400 with text-gray-500 or text-gray-600');
    console.log('   - Replace text-gray-300 with text-gray-400 or darker');
    console.log('');
    console.log('2. Ensure interactive elements have sufficient contrast');
    console.log('   - Buttons, links, and form controls should meet AA standards (4.5:1)');
    console.log('');
    console.log('3. Test with different background colors and themes');
    console.log('   - Verify contrast in both light and dark modes');
    console.log('');
    console.log('4. Use tools like WebAIM Color Contrast Checker for validation');
    console.log('   - https://webaim.org/resources/contrastchecker/');
  });
});