/* HET KLANTENBOEK: wie kocht er bij deze zaak, op codenaam.

   Dit stond al in kern/vakwerk/pro2.js, maar alleen voor de vakgenres. Elke
   andere zaak -- een restaurant, een winkel, een hotel -- had geen klantenboek,
   terwijl de vraag "wie zijn mijn klanten" niet aan een genre hangt. Het staat
   nu hier, en Vakwerk gebruikt deze en houdt er geen eigen op na (lat-regel 4).

   TWEE DINGEN ZIJN BEWUST ZO GEBLEVEN:

   - DE OPSLAGSLEUTEL BLIJFT `vakKlantNotities`. De notities die zaken al
     hebben geschreven staan daar, en een mooiere naam is geen reden om data te
     verhuizen. Een migratie die niets oplost is puur risico.
   - HET DRAAIT OP CODENAAM. Dit boek kent geen echte namen, en dat is geen
     tekortkoming maar het ontwerp: klantdata draait op codenamen, echte namen
     staan in de gescheiden kluis. Een CRM is precies de plek waar dat anders
     stilletjes zou sneuvelen.

   WAT ER WEL IS VERANDERD: bonnen tellen nu mee. Het oude boek keek alleen naar
   boekingen, dus wie bij dezelfde zaak at maar niet boekte, bestond niet. Een
   klant is een klant, langs welke weg hij ook kocht. */
'use strict';

/* De dag die telt voor een transactie: betaald, anders afgerond, anders
   aangemaakt. Stond in vakwerk/index.js; die haalt hem nu hier op, zodat er
   maar een definitie is van "wanneer was dit". */
const geldDag = (b) => String((b && (b.paidAt || b.finishedAt || b.at)) || '').slice(0, 10);

const rond = (n) => Math.round(n * 100) / 100;

module.exports = ({ db, save, scho, boekingenVanZaak, ordersVanZaak }) => {

  const eigen = require('./eigencollectie')({ db, domein: 'kern/klantenboek', bezit: { vakKlantNotities: 'kaart' } });
  const nots = (code) => {
    const alles = eigen.bak('vakKlantNotities');
    return (alles[code] = alles[code] || {});
  };

  /* Alles wat deze zaak aan transacties heeft, uit beide bronnen. Een boeking
     die nog op betaling wacht telt niet: dat is een voornemen en geen klant.
     Dezelfde grens als in kern/onderneming/beeld.js. */
  function transacties(code) {
    const uit = [];
    for (const b of (boekingenVanZaak(code) || [])) {
      if (!b || !b.customerCodename || b.status === 'wacht-op-betaling') continue;
      uit.push(b);
    }
    for (const o of (ordersVanZaak(code) || [])) {
      if (!o || !o.customerCodename) continue;
      uit.push(o);
    }
    return uit;
  }

  /* Het boek: per codenaam de historie, de omzet en de eigen notitie.
     Gesorteerd op omzet, dan op aantal -- wie het meest bijdraagt staat boven. */
  function klantenboek(code) {
    const per = new Map();
    for (const b of transacties(code)) {
      const k = per.get(b.customerCodename) ||
        { codenaam: b.customerCodename, aantal: 0, omzet: 0, laatste: null, eerste: null };
      k.aantal++;
      if (b.paid) k.omzet = rond(k.omzet + (Number(b.price) || Number(b.total) || 0));
      const dag = geldDag(b);
      if (dag && (!k.laatste || dag > k.laatste)) k.laatste = dag;
      if (dag && (!k.eerste || dag < k.eerste)) k.eerste = dag;
      per.set(b.customerCodename, k);
    }
    const n = nots(code);
    return [...per.values()]
      .map(k => Object.assign({}, k, { notitie: n[k.codenaam] || null }))
      .sort((a, b) => (b.omzet - a.omzet) || (b.aantal - a.aantal));
  }

  function klantNotitie(code, body) {
    const codenaam = scho((body || {}).codenaam, 60);
    if (!codenaam) return { status: 400, error: 'Voor welke klant is de notitie?' };
    const tekst = scho((body || {}).tekst, 200);
    const n = nots(code);
    if (tekst) n[codenaam] = tekst; else delete n[codenaam];
    save();
    return { status: 200, ok: true };
  }

  return { klantenboek, klantNotitie, klantTransacties: transacties };
};

module.exports.geldDag = geldDag;
