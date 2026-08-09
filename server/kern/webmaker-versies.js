/* Versiegeschiedenis van een website: bij elke bewaring gaat de VORIGE stand
   in de geschiedenis, zodat er altijd een weg terug is.

   Dit is er gekomen omdat twee knoppen in dit huis werk kunnen overschrijven
   zonder dat de maker het meteen ziet: de AI-assistent (die het hele ontwerp
   herschrijft) en "opnieuw uit mijn profiel" bij een bedrijfssite. Een
   ondernemer die na een AI-opdracht denkt "dit was het niet" hoort niet zijn
   avond kwijt te zijn.

   Twee dingen liggen hier vast en zijn geen detail:

   - HET ADRES EN DE ONLINE-STAND REIZEN NIET MEE. Een oude versie draagt oude
     blokken, geen oud adres: herstellen is een ontwerp-handeling en geen
     publicatie-handeling. Zou het adres meekomen, dan haalt "even terugkijken"
     je site uit de lucht of pakt hij een adres terug dat inmiddels van een
     ander is.
   - HERSTELLEN IS ZELF OOK EEN BEWARING. De stand van vlak voor het herstel
     gaat gewoon de geschiedenis in, dus wie zich vergist kan weer vooruit. */
module.exports = ({ store, save, scho }) => {
  const MAX = 10;   // hoeveel standen we per site bewaren

  function pot() {
    const s = store();
    if (!s.versies || typeof s.versies !== 'object') s.versies = {};
    return s.versies;
  }
  // alleen het ontwerp zelf; adres, online en bezoeken horen bij de site en
  // niet bij een stand ervan
  function ontwerpVan(d) {
    return { titel: d.titel, thema: d.thema, accent: d.accent, kleuren: d.kleuren || null,
             blokken: d.blokken || [], paginas: d.paginas || [], volgorde: d.volgorde || null };
  }

  /* De vorige stand wegleggen. Wordt aangeroepen vlak voordat een bestaande
     site wordt overschreven -- de aanroeper weet wanneer dat is, wij niet. */
  function leg(bestaand, reden) {
    if (!bestaand || !bestaand.id) return;
    const p = pot();
    const rij = p[bestaand.id] = (p[bestaand.id] || []);
    rij.unshift({
      op: new Date().toISOString(),
      reden: scho(reden, 40) || 'bewaard',
      blokken: (bestaand.blokken || []).length + (bestaand.paginas || []).reduce((n, x) => n + (x.blokken || []).length, 0),
      ontwerp: ontwerpVan(bestaand)
    });
    p[bestaand.id] = rij.slice(0, MAX);
  }

  // de lijst voor het scherm: wat er is, zonder het hele ontwerp mee te sturen
  function lijst(d) {
    if (!d) return [];
    return (pot()[d.id] || []).map((v, i) => ({ i, op: v.op, reden: v.reden, blokken: v.blokken }));
  }

  /* Terugzetten. `d` is de site zoals hij NU is (en dus al gecontroleerd op
     eigenaarschap door de aanroeper); i is de plek in de lijst. */
  function herstel(d, i) {
    const rij = pot()[d.id] || [];
    const v = rij[Number(i)];
    if (!v) return { error: 'Deze versie bestaat niet (meer).', status: 404 };
    leg(d, 'voor herstel');            // ook terug kunnen na een herstel
    const o = v.ontwerp;
    d.titel = o.titel; d.thema = o.thema; d.accent = o.accent; d.kleuren = o.kleuren || null;
    d.blokken = o.blokken || []; d.paginas = o.paginas || [];
    if (o.volgorde) d.volgorde = o.volgorde; else delete d.volgorde;
    d.bij = new Date().toISOString();
    save();
    return { ok: true, design: d };
  }

  // een site die weg is, laat geen geschiedenis achter
  function wis(id) { const p = pot(); delete p[id]; }

  return { leg, lijst, herstel, wis, MAX };
};
