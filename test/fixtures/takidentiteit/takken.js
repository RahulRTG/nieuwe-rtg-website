'use strict';
function kies(c, d) {
  if (c) {
    return 'a';
  } else {
    if (d) return 'b';
  }
  return 'c';
}
function teken(a) { return a ? (a > 5 ? 'x' : 'y') : 'z'; }
function soort(k) {
  switch (k) {
    case 1: return 'een';
    case 2: return 'twee';
    default: return 'anders';
  }
}
function nooit(n) { return n > 0 ? 'pos' : 'neg'; }
module.exports = { kies, teken, soort, nooit };
