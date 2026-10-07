// ---------- small expression language for numeric arguments (src/fmide/modules/expression.js) ----------
// Numbers, + - * / % ( ), $variables, and min/max/round/floor/ceil/abs(...) — what a macro step
// or fm.* action takes where a number goes (fmIDE's automation layer, 13-automation-core.js).
// A module (step 3c): what it needs from fmIDE comes in `env` —
//   env.lookupVar(token)  a macro variable's value ('$r1', '$t1[2]'); throws when there is none
//   env.fail(message)     stops with that message (throws)
// The text is read by this small parser only, never run as code.
export function evalExpression(src, env){
  const { lookupVar, fail } = env;
  let i = 0;
  const s = String(src);
  function ws(){ while(i < s.length && /\s/.test(s[i])) i++; }
  function expr(){
    let v = term();
    for(;;){ ws(); const c = s[i]; if(c === '+'){ i++; v += term(); } else if(c === '-'){ i++; v -= term(); } else return v; }
  }
  function term(){
    let v = factor();
    for(;;){
      ws(); const c = s[i];
      if(c === '*'){ i++; v *= factor(); }
      else if(c === '/'){ i++; v /= factor(); }
      else if(c === '%'){ i++; v %= factor(); }
      else return v;
    }
  }
  function factor(){
    ws();
    const c = s[i];
    if(c === '-'){ i++; return -factor(); }
    if(c === '+'){ i++; return factor(); }
    if(c === '('){ i++; const v = expr(); ws(); if(s[i] !== ')') fail(`Missing ")" in "${s}".`); i++; return v; }
    if(c === '$'){
      const m = /^\$[A-Za-z_]\w*(\[\d+\])?/.exec(s.slice(i));
      if(!m) fail(`Bad variable in "${s}".`);
      i += m[0].length;
      const v = lookupVar(m[0]);
      const num = typeof v === 'number' ? v : Number(v);
      if(!isFinite(num)) fail(`${m[0]} is not a number (it is "${v}").`);
      return num;
    }
    let m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s.slice(i));
    if(m){ i += m[0].length; return Number(m[0]); }
    m = /^(min|max|round|floor|ceil|abs)\s*\(/i.exec(s.slice(i));
    if(m){
      i += m[0].length;
      const args = [expr()];
      ws();
      while(s[i] === ','){ i++; args.push(expr()); ws(); }
      if(s[i] !== ')') fail(`Missing ")" in "${s}".`);
      i++;
      return Math[m[1].toLowerCase()](...args);
    }
    fail(`Could not read the number or expression "${s}".`);
  }
  const v = expr();
  ws();
  if(i < s.length) fail(`Unexpected "${s.slice(i)}" in "${s}".`);
  return v;
}
export function readNumber(v, label, env){
  const { fail } = env;
  if(typeof v === 'number'){ if(!isFinite(v)) fail(`${label} is not a finite number.`); return v; }
  if(typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim();
  if(s === '') fail(`${label} is empty.`);
  const n = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : evalExpression(s, env);
  if(!isFinite(n)) fail(`${label} is not a finite number.`);
  return n;
}
export function readBool(v, env){
  const { fail } = env;
  if(typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if(['true','yes','y','1','on'].includes(s)) return true;
  if(['false','no','n','0','off',''].includes(s)) return false;
  fail(`"${v}" is not true/false.`);
}
