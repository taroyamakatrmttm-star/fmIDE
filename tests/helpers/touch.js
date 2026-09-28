// A finger for the touch tests: real touch input through the Chrome DevTools Protocol
// (Input.dispatchTouchEvent), not mouse events. Points are page coordinates.
async function finger(page){
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y })) });
  return {
    async tap(p){ await send('touchStart', [p]); await send('touchEnd', []); },
    // Two taps in the same place, quickly (a double-tap).
    async doubleTap(p){ await send('touchStart', [p]); await send('touchEnd', []); await send('touchStart', [p]); await send('touchEnd', []); },
    // Press and hold, still, past the hold time (0.5 s), then lift.
    async hold(p){ await send('touchStart', [p]); await page.waitForTimeout(700); await send('touchEnd', []); },
  };
}

// Every pointerdown the page sees, by type: proves the input was touch, not a mouse.
async function watchPointerTypes(page){
  await page.evaluate(() => {
    window.__pointerTypes = [];
    window.addEventListener('pointerdown', (ev) => window.__pointerTypes.push(ev.pointerType), true);
  });
  return async () => page.evaluate(() => Array.from(new Set(window.__pointerTypes)));
}

const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

module.exports = { finger, watchPointerTypes, centre };
