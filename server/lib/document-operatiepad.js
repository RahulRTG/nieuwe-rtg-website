/* Both transport caches defer to the domain receipt and current authorization.
   Defensively cover case and slash variants, even though the router rejects them. */
'use strict';
module.exports = pad => /^\/api\/bestanden\/(actie|weg|herstel)\/?$/i.test(pad || '');
