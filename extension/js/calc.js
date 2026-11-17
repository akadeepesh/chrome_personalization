// Safe arithmetic evaluator (recursive descent, no eval).
// Supports + - * / % ^, parentheses, implicit multiplication (2pi, 3(4+1)),
// constants pi/e and common functions.

const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  ln: Math.log, log: Math.log10, floor: Math.floor, ceil: Math.ceil, round: Math.round,
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const tokens = [];
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z]+)|([-+*/%^()]))/giy;
  let m;
  while (re.lastIndex < src.length) {
    const start = re.lastIndex;
    if (!(m = re.exec(src))) {
      if (/^\s*$/.test(src.slice(start))) break;
      return null;
    }
    if (m[1] !== undefined) tokens.push({ t: 'num', v: parseFloat(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: 'id', v: m[2].toLowerCase() });
    else tokens.push({ t: 'op', v: m[3] });
  }
  return tokens;
}

function parse(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const isOp = (v) => peek()?.t === 'op' && peek().v === v;
  const fail = () => { throw new SyntaxError(); };

  function expr() {
    let v = term();
    while (isOp('+') || isOp('-')) v = tokens[i++].v === '+' ? v + term() : v - term();
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      if (isOp('*')) { i++; v *= unary(); }
      else if (isOp('/')) { i++; v /= unary(); }
      else if (isOp('%')) { i++; v %= unary(); }
      else if (peek() && (peek().t !== 'op' || peek().v === '(')) v *= unary(); // implicit
      else return v;
    }
  }
  function unary() {
    if (isOp('-')) { i++; return -unary(); }
    if (isOp('+')) { i++; return unary(); }
    return power();
  }
  function power() {
    const base = primary();
    if (isOp('^')) { i++; return base ** unary(); }
    return base;
  }
  function primary() {
    const tok = tokens[i++];
    if (!tok) fail();
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'op' && tok.v === '(') {
      const v = expr();
      if (!isOp(')')) fail();
      i++;
      return v;
    }
    if (tok.t === 'id') {
      if (tok.v in CONSTS) return CONSTS[tok.v];
      if (tok.v in FUNCS) {
        if (!isOp('(')) fail();
        i++;
        const v = expr();
        if (!isOp(')')) fail();
        i++;
        return FUNCS[tok.v](v);
      }
    }
    fail();
  }

  const v = expr();
  if (i !== tokens.length) fail();
  return v;
}

/** Returns a formatted result string, or null if the input isn't a calculation. */
export function evaluate(input) {
  const src = input.replace(/[×x](?=\s*[\d.(])/g, '*').replace(/÷/g, '/').replace(/(\d),(?=\d{3}\b)/g, '$1');
  if (!/[\d)]|pi\b/i.test(src)) return null;
  const tokens = tokenize(src);
  if (!tokens || tokens.length < 2) return null;
  // Must contain an operator or a function call; "2024" alone isn't a calculation.
  if (!tokens.some((t) => (t.t === 'op' && t.v !== '(' && t.v !== ')') || (t.t === 'id' && t.v in FUNCS))) return null;
  try {
    const v = parse(tokens);
    if (!Number.isFinite(v)) return null;
    return String(Number(v.toPrecision(12)));
  } catch {
    return null;
  }
}
