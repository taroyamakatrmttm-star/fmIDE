// Shared Playwright fixture: serves the two single-file apps from a fake origin and keeps
// every test offline. Any request that isn't the app itself is aborted and counted; a test
// fails if that count is not 0.
const base = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const APPS_DIR = path.join(ROOT, 'apps');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const ORIGIN = 'http://local.test/';
const APP_FILES = { ExcelExporter: 'ExcelExporter.html', fmIDE: 'fmIDE.html' };

function fixture(...parts){ return path.join(FIXTURES, ...parts); }
function readFixture(...parts){ return JSON.parse(fs.readFileSync(fixture(...parts), 'utf8')); }

const test = base.test.extend({
  // Requests that were blocked because they tried to leave the app.
  blocked: async ({ context }, use) => {
    const blocked = [];
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if(url.startsWith(ORIGIN)){
        const name = decodeURIComponent(url.slice(ORIGIN.length).split(/[?#]/)[0]);
        const file = Object.values(APP_FILES).includes(name) ? path.join(APPS_DIR, name) : null;
        if(file){
          return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(file) });
        }
      }
      blocked.push(url);
      return route.abort('blockedbyclient');
    });
    // WebSockets bypass page.route; block and count them too.
    await context.routeWebSocket(/.*/, (ws) => { blocked.push(ws.url()); ws.close(); });
    await use(blocked);
    base.expect(blocked, 'the app tried to reach the network').toEqual([]);
  },
  // Page errors (uncaught exceptions) — collected so tests can assert there were none.
  pageErrors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(errors);
  },
  page: async ({ page, blocked }, use) => {
    void blocked; // make sure the network guard is installed before the page is used
    await use(page);
  },
});

// Each test runs in a fresh browser context, so localStorage starts empty.
async function openApp(page, app){
  await page.goto(ORIGIN + APP_FILES[app]);
}

module.exports = { test, expect: base.expect, ORIGIN, ROOT, FIXTURES, fixture, readFixture, openApp };
