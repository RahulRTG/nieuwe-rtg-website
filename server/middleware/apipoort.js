/* DE MIDDLEWARE VAN DE API-POORT: wat een koppeling van buiten tegenkomt.

   Hij staat op /api/extern/ en nergens anders. Dat is met opzet één duidelijk
   voorvoegsel: een poort die overal een beetje voor kan hangen, is niet meer na
   te lopen, en dan weet niemand meer welke deuren er zijn.

   DE ANTWOORDEN ZEGGEN WAT ER MIS IS, want een koppeling die "403" krijgt zonder
   reden gaat gokken, en gokken tegen een poort ziet er in het logboek uit als
   een aanval. 401 sleutel, 403 scope, 410 uitgefaseerd, 429 quotum -- elk met
   een zin erbij.

   EN HET RESTERENDE QUOTUM STAAT IN EEN KOP. Wie zijn eigen tempo kan zien,
   hoeft er niet tegenaan te lopen. */
'use strict';

function apiPoortMiddleware(kern) {
  return function apiPoort(req, res, next) {
    if (!req.path.startsWith('/api/extern/')) return next();
    const poort = kern && kern.command && kern.command.apipoort;
    if (!poort) return res.status(503).json({ error: 'De API-poort staat niet aan.' });

    const kop = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const uit = poort.apiSleutelOk(kop, req.path, req.method);
    if (!uit.ok) {
      if (uit.status === 429 && uit.herstartOver) res.set('retry-after', String(uit.herstartOver));
      return res.status(uit.status).json({ error: uit.reden });
    }
    res.set('x-rtg-api-versie', String(uit.versie || 'v1'));
    res.set('x-rtg-quota-rest', String(uit.rest));
    /* Uitfasering wordt aangekondigd zolang hij nog werkt. Pas na de datum
       weigert de poort, met dezelfde reden. */
    if (uit.uitfasering) res.set('sunset', String(uit.uitfasering));
    req.apiSleutel = { id: uit.sleutel, naam: uit.naam };
    next();
  };
}

module.exports = { apiPoortMiddleware };
