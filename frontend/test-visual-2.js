const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/chromium-browser'
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  // Login first
  console.log('Logging in...');
  await page.goto('http://localhost:4200');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  
  // Go to Schedules
  console.log('Going to Schedules...');
  await page.click('text=Schedules');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/07-schedules-page.png', fullPage: true });
  console.log('Screenshot saved: /tmp/07-schedules-page.png');
  
  // Select line and stop to see schedules
  console.log('Selecting line and stop...');
  await page.selectOption('select:first-of-type', { index: 1 }); // Select first line
  await page.waitForTimeout(500);
  await page.selectOption('select:nth-of-type(2)', { index: 1 }); // Select first stop
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/08-schedules-with-entries.png', fullPage: true });
  console.log('Screenshot saved: /tmp/08-schedules-with-entries.png');
  
  // Go to kiosk display
  console.log('Going to kiosk display...');
  await page.goto('http://localhost:4200/display/2d079939-d9c3-403e-8094-b76e431e82ef');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/09-kiosk-display.png', fullPage: true });
  console.log('Screenshot saved: /tmp/09-kiosk-display.png');
  
  console.log('All screenshots taken!');
  await browser.close();
})();
