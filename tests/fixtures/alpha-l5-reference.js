export const L5_LOG = `<a,b,e,f>^2
<a,b,e,c,d,b,f>^3
<a,b,c,e,d,b,f>^2
<a,b,c,d,e,b,f>^4
<a,e,b,c,d,b,f>^3`;

export const L5_REFERENCE = {
  directlyFollows: [
    'a > b', 'a > e', 'b > c', 'b > e', 'b > f', 'c > d', 'c > e',
    'd > b', 'd > e', 'e > b', 'e > c', 'e > d', 'e > f',
  ],
  causality: ['a → b', 'a → e', 'b → c', 'b → f', 'c → d', 'd → b', 'e → f'],
  parallel: ['b ∥ e', 'c ∥ e', 'd ∥ e'],
  unrelated: ['a # c', 'a # d', 'a # f', 'c # f', 'd # f'],
  footprint: {
    a: { a: '#', b: '→', c: '#', d: '#', e: '→', f: '#' },
    b: { a: '←', b: '#', c: '→', d: '←', e: '∥', f: '→' },
    c: { a: '#', b: '←', c: '#', d: '→', e: '∥', f: '#' },
    d: { a: '#', b: '→', c: '←', d: '#', e: '∥', f: '#' },
    e: { a: '←', b: '∥', c: '∥', d: '∥', e: '#', f: '→' },
    f: { a: '#', b: '←', c: '#', d: '#', e: '←', f: '#' },
  },
  XL: [
    '{a,d}→{b}', '{a}→{b}', '{a}→{e}', '{b}→{c,f}', '{b}→{c}',
    '{b}→{f}', '{c}→{d}', '{d}→{b}', '{e}→{f}',
  ],
  YL: ['{a,d}→{b}', '{a}→{e}', '{b}→{c,f}', '{c}→{d}', '{e}→{f}'],
  PL: [
    'i_L', 'p({a,d}→{b})', 'p({a}→{e})', 'p({b}→{c,f})',
    'p({c}→{d})', 'p({e}→{f})', 'o_L',
  ],
  FL: [
    'i_L→a',
    'a→p({a,d}→{b})', 'd→p({a,d}→{b})', 'p({a,d}→{b})→b',
    'a→p({a}→{e})', 'p({a}→{e})→e',
    'b→p({b}→{c,f})', 'p({b}→{c,f})→c', 'p({b}→{c,f})→f',
    'c→p({c}→{d})', 'p({c}→{d})→d',
    'e→p({e}→{f})', 'p({e}→{f})→f',
    'f→o_L',
  ],
};
