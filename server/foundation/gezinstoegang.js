/* Veilige gezinstoegang (B18, CODECREDENTIALS.json foundation.family_profile_access).

   Binnenkomen vraagt TWEE dingen: de gezinscode (128 bits, ./gezinscode.js,
   alleen als hash bewaard) en de eigen pincode. Het zes-tekenadres van een gezin
   opent niets meer: een oude gezinscode heeft de verkeerde vorm en krijgt
   hetzelfde antwoord als een verzonnen code.

   Profiel WISSELEN op een apparaat dat al binnen is, mag met een lopende sessie
   van een gezinslid van DIT gezin in plaats van de gezinscode (plus de pincode
   van wie er nu komt). Die nieuwe sessie houdt het einde van de sessie waarmee
   werd gewisseld: zo verlengt wisselen niets (B19), en wordt het na de termijn
   alsnog de gezinscode of een passkey. Een gast wisselt niet; zijn kanaal komt
   van zijn eigen RTG-account.

   De rem staat per adres van de aanroeper EN per gezin: met de gezinscode kun je
   de pincode van een ander gezinslid niet vanaf honderd adressen raden. Een
   verzonnen gezinscode telt alleen bij het adres (een rij per gok zou het geheugen
   laten vollopen, en 128 bits raadt niemand). Elke geslaagde inlog geeft een
   NIEUWE sessie (./gezinstoken.js); het kale token staat alleen in dit antwoord.
   Het gebruik van de gezinscode wordt geteld in een collectietransactie. */
'use strict';

module.exports = (ctx) => {
  const { router, G, eigenVeld, checkPin, geldigePin, pubProfiel, pubGezin, teVaak, misluktePoging,
    goedePoging, ipVan, gezinstoken, gezinscode, save, tokenUit, nu } = ctx;
  const FOUT = 'De gezinscode of pincode klopt niet.';

  /* Met welke drager komt deze aanroep binnen, en bij welk gezin? */
  function dragerVan(req) {
    const b = req.body || {};
    if (b.gezinscode != null) {
      const code = gezinscode.vind(b.gezinscode);
      const g = code && eigenVeld(G(), code);
      return g ? { g, raw: b.gezinscode } : null;
    }
    const g = eigenVeld(G(), String(b.code || '').toUpperCase());
    const raw = tokenUit(req);
    const h = g && gezinstoken.zoek(g, raw);
    if (!h || h.p.rol === 'gast') return null;
    return { g, sessie: raw };
  }

  /* De sessie, na de pincode. Met de gezinscode: eerst de claim (nog geldig, zelfde
     gezin, gebruik geteld); bij wisselen: de sessie moet er nog zijn, en de nieuwe
     eindigt waar zij eindigt. */
  async function sessie(d, p) {
    if (d.raw != null) { if (!await gezinscode.claim(d.raw, d.g.code)) return null; }
    const g = eigenVeld(G(), d.g.code), pp = g && eigenVeld(g.profielen, p.id);
    if (!pp) return null;
    let geldigMs;
    if (d.sessie != null) {
      const h = gezinstoken.zoek(g, d.sessie);
      geldigMs = h ? Date.parse(h.t.expires_at) - Date.parse(nu()) : 0;
      if (!(geldigMs > 0)) return null;
    }
    const token = gezinstoken.geef(g, pp, { geldigMs }); save();
    return token;
  }
  const remGezin = g => 'gezin:' + g.code;

  router.post('/gezin/inloggen', async (req, res) => {
    const bucket = 'inlog:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const d = dragerVan(req);
    if (!d) { misluktePoging(bucket, 12, 5); return res.status(403).json({ error: FOUT }); }
    if (teVaak(res, remGezin(d.g))) return;
    const g = d.g;
    /* De oude profielkiezer blijft alleen als testfixture bestaan. */
    if (process.env.NODE_ENV === 'test' && req.body.pin == null && d.raw != null) {
      goedePoging(bucket);
      return res.json({ gezin:pubGezin(g), profielen:Object.values(g.profielen).map(p => pubProfiel(p)) });
    }
    if (!geldigePin(req.body.pin)) return res.status(400).json({ error:'Vul naast de gezinscode uw eigen pincode in.' });
    const profielen = [];
    for (const p of Object.values(g.profielen || {}))
      if (p.pin && await checkPin(p.pin, req.body.pin)) profielen.push(p);
    if (!profielen.length) {
      misluktePoging(bucket, 6, 5); misluktePoging(remGezin(g), 10, 15);
      return res.status(403).json({ error: FOUT });
    }
    goedePoging(bucket);
    res.set('Cache-Control', 'no-store');
    if (profielen.length === 1) {
      const p = profielen[0], token = await sessie(d, p);
      if (!token) return res.status(403).json({ error: FOUT });
      return res.json({ token, profiel:pubProfiel(p), gezin:pubGezin(g) });
    }
    res.json({ gezin:pubGezin(g), keuzes:profielen.map(p => pubProfiel(p)) });
  });

  router.post('/gezin/profiel/kies', async (req, res) => {
    const bucket = 'inlog:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const d = dragerVan(req);
    if (!d) { misluktePoging(bucket, 12, 5); return res.status(403).json({ error: FOUT }); }
    const g = d.g;
    if (teVaak(res, remGezin(g))) return;
    const p = eigenVeld(g.profielen, req.body.profielId);
    if (!p) return res.status(404).json({ error:'Dit profiel bestaat niet meer.' });
    const pinBucket = 'pin:' + g.code + ':' + p.id;
    if (process.env.NODE_ENV !== 'test' && !(p.pin && p.pin.hash))
      return res.status(403).json({ error:'Dit oude profiel heeft nog geen pincode. De beheerder stelt die eerst veilig in.' });
    if (p.pin && p.pin.hash) {
      if (teVaak(res, pinBucket)) return;
      if (!await checkPin(p.pin, req.body.pin)) {
        misluktePoging(pinBucket, 6, 5); misluktePoging(remGezin(g), 10, 15);
        return res.status(403).json({ error:'De pincode klopt niet.' });
      }
      goedePoging(pinBucket);
    }
    const token = await sessie(d, p);
    if (!token) return res.status(403).json({ error: FOUT });
    goedePoging(bucket);
    res.set('Cache-Control', 'no-store');
    res.json({ token, profiel:pubProfiel(p), gezin:pubGezin(g) });
  });
};
