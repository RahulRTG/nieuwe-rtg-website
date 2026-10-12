'use strict';
/* Een fout met een code en een HTTP-status, zodat de route hem zonder raden kan
   doorgeven; `extra` draagt bijvoorbeeld `nietVerstuurd` of `opnieuw`. */
function fout(bericht, code, status, extra) {
  const e = new Error(bericht); e.code = code; e.status = status; if (extra) Object.assign(e, extra); return e;
}
module.exports = { fout };
