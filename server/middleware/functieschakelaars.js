'use strict';
/* Handhaving en actieprojectie lezen dezelfde policy, bij ieder verzoek opnieuw.
   Alleen deze middleware telt verkeer en schrijft het HTTP-antwoord. */
const { natieNaarLand } = require('./functieschakelaars-tekst');
const { ZIN } = require('./schakelaar-antwoord');
const techniekIsolatie = require('./techniek-isolatiepoort');
function schakelaars(ctx) {
  const beoordeel = require('./functiebeleid')(ctx);
  return (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (req.path === '/api/health' || req.path === '/api/ready') return next();
    if (techniekIsolatie.behandel(req, res, next, ctx)) return;
    if (ctx.wachter) res.on('finish', () => { try { ctx.wachter.meet(req.path, res.statusCode); } catch (e) {} });
    req.routeBeleid = pad => beoordeel(Object.assign(Object.create(req), { path: pad, method: 'POST' }));
    const dicht = beoordeel(req);
    if (dicht) return res.status(dicht.status).json(dicht.antwoord);
    next();
  };
}
module.exports = { schakelaars, natieNaarLand, ZIN };
