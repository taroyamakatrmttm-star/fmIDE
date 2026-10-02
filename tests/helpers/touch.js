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

// Two fingers (step 13b, the pinch): a and b are page coordinates, each finger with its own id.
// down() puts the first finger down and then the second (a second touchStart, as a hand does);
// move() moves both; pinch() moves both from where they are to new places in even steps.
async function twoFingers(page){
  const cdp = await page.context().newCDPSession(page);
  const pt = (p, id) => ({ x: p.x, y: p.y, id });
  let at = null;
  const api = {
    async first(a){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(a, 1)] }); at = [a]; },
    async moveFirst(a){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(a, 1)] }); at = [a]; },
    async second(b){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(at[0], 1), pt(b, 2)] }); at = [at[0], b]; },
    async down(a, b){ await api.first(a); await api.second(b); },
    async move(a, b){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(a, 1), pt(b, 2)] }); at = [a, b]; },
    async pinch(a, b, steps = 8){
      const [a0, b0] = at;
      for(let i = 1; i <= steps; i++){
        const f = i / steps, lerp = (p, q) => ({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f });
        await api.move(lerp(a0, a), lerp(b0, b));
      }
    },
    async up(){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); at = null; },
  };
  return api;
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

module.exports = { finger, twoFingers, watchPointerTypes, centre };
