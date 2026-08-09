/* RTG Podium, deelbestand "handel": LIVE VERKOPEN (zone 'handel').

   De maker legt productkaarten klaar -- naam, prijs, voorraad -- en een kijker
   rekent tijdens de uitzending af langs precies dezelfde RTG Pay-route als een
   cadeau of een kaartje. Geen tweede betaalweg, geen tweede saldo.

   WAT DIT WEL IS: het geld gaat van koper naar maker, de voorraad daalt met
   een, en er komt een bestelregel bij de maker te staan met de CODENAAM van de
   koper. Het bonnetje van de koper is zijn eigen RTG Pay-overzicht, want daar
   staat de betaling al -- een tweede kopie van diezelfde waarheid zou alleen
   maar uit elkaar kunnen lopen (LAT.md regel 4).

   WAT DIT NIET IS, en dat hoort er hardop bij te staan: RTG bezorgt niets. Er
   is geen adres, geen verzending, geen track & trace en geen retourregeling.
   De maker zet daarom bij elke kaart hoe de koper het krijgt (afhalen, een link
   in de chat, per post na een bericht) en die tekst gaat mee naar de koper.
   Zolang de bezorging niet in dit huis zit, mag het scherm hem ook niet
   beloven (LAT.md regel 6). Staat als open punt in TAKEN.md.

   DE VOORRAAD IS ECHT EN DAAROM ZICHTBAAR. "Nog 2" is geen opjaagmechaniek als
   het er ook werkelijk twee zijn: het is het antwoord op de vraag of kopen nog
   zin heeft. Wat hier NIET staat is een aftelklok, een "12 mensen kijken hier
   nu naar" of een prijs die stijgt -- dat zijn verzonnen urgenties en die horen
   niet in dit huis.

   Krijgt de gedeelde ctx van kern/podium/index.js. */
const MAX_WAREN = 12;         // een kanaal is een uitzending, geen webwinkel
const MAX_CENTEN = 500000;    // 5000 euro; daarboven hoort een echte kassa

/* Wat een KIJKER van de kraam ziet: alleen de kaarten die aanstaan, en alleen
   in een zone waar verkopen mag. Verhuist een kanaal naar een andere wereld,
   dan verdwijnt de kraam vanzelf -- de zonetabel beslist, niet dit bestand. */
function beeld(k, magVerkopen) {
  if (!magVerkopen) return [];
  return (k.waren || []).filter(w => w.aan !== false).map(w => ({
    id: w.id, naam: w.naam, centen: w.centen, voorraad: w.voorraad,
    levering: w.levering || null, uitverkocht: !(w.voorraad > 0)
  }));
}

module.exports = (ctx) => {
  const { save, nu, id, schoon, kanaalMet, kanaalVan, metIdem, codenaamVan,
    sseToCustomer, stuurRond, pay, poort } = ctx;

  const getal = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0; };
  // het beeld voor de MAKER: ook de uitgezette kaarten, want die beheert hij
  const mijnWaren = (k) => (k.waren || []).map(w => ({ ...w }));

  /* ---- de kraam inrichten (alleen de maker) ---- */
  function waarZet(key, data) {
    const k = kanaalVan(key); if (!k) return { status: 404, error: 'U heeft nog geen kanaal.' };
    if (!poort.geldMag(k, 'verkoop')) return { status: 409, error: 'In deze zone wordt niets verkocht.' };
    k.waren = k.waren || [];
    const bestaand = data.id ? k.waren.find(w => w.id === String(data.id)) : null;
    if (data.id && !bestaand) return { status: 404, error: 'Deze productkaart bestaat niet.' };
    if (data.weg === true) {
      if (!bestaand) return { status: 400, error: 'Kies een productkaart.' };
      k.waren = k.waren.filter(w => w !== bestaand); save();
      return { status: 200, ok: true, waren: mijnWaren(k) };
    }
    const w = bestaand || { id: id(), aan: true, at: nu() };
    if (!bestaand && k.waren.length >= MAX_WAREN)
      return { status: 409, error: 'Meer dan ' + MAX_WAREN + ' productkaarten worden het een webwinkel.' };
    if (data.naam != null) { const n = schoon(data.naam, 60); if (n) w.naam = n; }
    if (!w.naam) return { status: 400, error: 'Geef de productkaart een naam.' };
    if (data.centen != null) w.centen = getal(data.centen, MAX_CENTEN);
    if (data.voorraad != null) w.voorraad = getal(data.voorraad, 999);
    if (data.levering != null) w.levering = schoon(data.levering, 120);
    if (data.aan != null) w.aan = data.aan !== false;
    if (!(w.centen > 0)) return { status: 400, error: 'Zet een prijs op de productkaart.' };
    if (!bestaand) k.waren.push(w);
    save();
    return { status: 200, ok: true, waar: { ...w }, waren: mijnWaren(k) };
  }

  /* ---- kopen tijdens de uitzending ---- */
  async function koop(key, kid, waarId, idem) {
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    const m = poort.magKanaal(key, k); if (!m.ok) return { status: 403, error: m.reden, kaartje: !!m.kaartje };
    if (!poort.geldMag(k, 'verkoop')) return { status: 409, error: 'In deze zone wordt niets verkocht.' };
    if (k.key === key) return { status: 400, error: 'Dit is uw eigen kraam.' };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    const w = (k.waren || []).find(x => x.id === String(waarId || '') && x.aan !== false);
    if (!w) return { status: 404, error: 'Deze productkaart bestaat niet.' };
    if (!(w.centen > 0)) return { status: 409, error: 'Op deze productkaart staat geen prijs.' };
    /* Dezelfde volgorde als bij het kaartje, en om dezelfde reden: EERST de
       idempotentie, DAARNA de voorraad. Andersom krijgt een dubbeltik op de
       laatste eenheid "uitverkocht" terug terwijl hij hem zelf net kocht. */
    return metIdem(k, idem ? 'w:' + key + ':' + idem : null, async () => {
      if (!(w.voorraad > 0)) return { status: 409, error: 'Deze is uitverkocht.', uitverkocht: true };
      const r = await pay.stuur({ van: codenaamVan(key), aanCodenaam: codenaamVan(k.key), centen: w.centen,
        oms: 'Podium · ' + w.naam + ' bij ' + k.naam, idem: idem ? 'podiumkoop:' + idem : undefined, soort: 'podium' });
      if (r.error) return { status: r.status || 400, error: r.error };
      w.voorraad = Math.max(0, w.voorraad - 1);
      k.verdiend = Math.round((k.verdiend || 0) + w.centen);
      const bestelling = { id: id(), waarId: w.id, naam: w.naam, centen: w.centen,
        koper: key, codenaam: codenaamVan(key), levering: w.levering || null, at: nu() };
      k.verkopen = (k.verkopen || []).concat([bestelling]).slice(-200);
      save();
      /* De ZAAL krijgt alleen de voorraad te horen, niet wie er kocht: dat de
         laatste weg is, is nieuws voor iedereen; wie hem kocht is dat niet. De
         bestelling zelf gaat alleen naar de maker. */
      stuurRond(k, { kind: 'waar', kanaalId: k.id, waarId: w.id, voorraad: w.voorraad });
      sseToCustomer(k.key, 'podium', { kind: 'bestelling', kanaalId: k.id, bestelling });
      return { status: 200, ok: true, bestelling, voorraad: w.voorraad, saldo: r.saldo };
    });
  }

  return { podiumWaarZet: waarZet, podiumKoop: koop };
};
module.exports.beeld = beeld;
module.exports.MAX_WAREN = MAX_WAREN;
