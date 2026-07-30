/* School (deelmodule): de thuistaal van een klasgenoot. Een kind uit het
   buitenland ziet de klas TWEETALIG: de eigen taal ernaast, en het Nederlands
   blijft altijd staan -- dat is de taal die het erbij leert. De ouder (of het
   kind zelf) kiest de taal; de leraar ziet hem in het klasoverzicht, zodat
   hij weet wie extra taalsteun verdient. Vertalen loopt via de bestaande
   vertaallaag (AI als er een sleutel is, anders het woordenboek; nooit kapot). */
const { bestaat } = require('../talen');
const vertaal = require('../translate');

module.exports = (sctx) => {
  const { router, save, eigenVeld, K, gezinSessie, leerlingVan } = sctx;

  router.post('/school/taal', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const profielId = s.beheerder && req.body.profielId ? String(req.body.profielId) : s.p.id;
    const l = leerlingVan(k, s.g, profielId);
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    const taal = String(req.body.taal || '').toLowerCase().trim();
    if (taal && taal !== 'nl' && !bestaat(taal)) return res.status(400).json({ error: 'Deze taal kennen we niet.' });
    l.taal = taal && taal !== 'nl' ? taal : null;
    save();
    res.json({ ok: true, taal: l.taal });
  });

  /* de tweetalige laag voor het gezinsoverzicht: huiswerk en mededelingen in
     de thuistaal ERBIJ. Het Nederlands wordt nooit vervangen: naast elkaar
     lezen is precies hoe je een taal erbij leert. */
  sctx.tweetalig = async function tweetalig(k, l) {
    if (!l.taal) return null;
    const uit = { taal: l.taal, huiswerk: {}, mededelingen: {} };
    for (const h of (k.huiswerk || []).slice(0, 30)) {
      const t = await vertaal.translate(h.titel, l.taal, 'nl');
      const o = h.omschrijving ? await vertaal.translate(h.omschrijving, l.taal, 'nl') : null;
      uit.huiswerk[h.id] = { titel: t.text, omschrijving: o ? o.text : null };
    }
    for (const m of (k.mededelingen || []).slice(0, 20)) {
      uit.mededelingen[m.id] = (await vertaal.translate(m.tekst, l.taal, 'nl')).text;
    }
    return uit;
  };
};
