const { test } = require('playwright/test');
test('smoke', async ({ page }) => {
  await page.goto('http://127.0.0.1:30010/login');
});
