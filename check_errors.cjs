const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/patient', { waitUntil: 'networkidle0' });
  
  const errors = await page.evaluate(() => document.getElementById('error-display').innerText);
  console.log('ERRORS ON PAGE:\n', errors);
  
  await browser.close();
})();
