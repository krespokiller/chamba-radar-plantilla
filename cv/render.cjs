const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [, , input, output] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(input));
  await page.pdf({ path: output, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await browser.close();
})();
