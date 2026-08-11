/* Hospitality Guest OS (kern): DE VERZOEKEN -- wat een gast VRAAGT in plaats
   van bestelt.

   Dit ontbrak, en het is het meest alledaagse dat er is. Een gast kon op zijn
   telefoon bestellen en afrekenen, maar niet zeggen "kunt u even komen", "de
   rekening graag" of "er zit iets niet goed". Dat betekende in de praktijk:
   zwaaien. Een systeem dat het makkelijke deel (geld) digitaliseert en het
   menselijke deel (aandacht) laat liggen, verplaatst het werk naar de gast.

   EEN VERZOEK IS GEEN BESTELLING, en die grens is hier hard:

   1. HET KOST NIETS EN ZET NIETS OP DE REKENING. Er komt geen regel bij, er
      verandert geen bedrag. Wat wél geld kost gaat door de bestellaag, met de
      beleidscontrole die daarbij hoort. Een "verzoekje" waar stilletjes een
      flesje water van EUR 4,50 uit volgt, is een bestelling met een
      vriendelijke naam.
   2. NIEMAND BELOOFT EEN TIJD. Er staat geen "iemand is er binnen 2 minuten".
      Dat weten we niet, en een belofte die de zaak niet heeft gedaan is een
      belofte die de zaak moet inlossen. Wat er wél staat is hoe lang het
      verzoek al open staat -- een feit, en precies het getal waar een
      gerechtvaardigd ongeduld op mag leunen.
   3. EEN VERZOEK DAT NIEMAND ZIET IS ERGER DAN GEEN KNOP. Wie op een knop
      drukt die niets doet, wacht langer dan wie meteen zwaait. Daarom staat
      elk verzoek op de wachtrij van de zaak MET zijn leeftijd, blijft het
      staan tot een mens het sluit, en telt `oud` hoeveel er te lang staan.
   4. RAHUL BESLIST NIET WAT EEN MENS HOORT TE BESLISSEN. Een klacht of een
      verzoek om iets recht te zetten gaat naar een medewerker. Deze laag
      biedt niets aan, geeft niets weg en zegt niets toe -- dat is de regel
      uit CLAUDE.md, hier toegepast op het moment waarop hij het meest
      verleidelijk is om te breken. */
'use strict';

/* De soorten. Een vaste lijst en geen vrij veld als hoofdingang: een keuze
   die de zaak kan groeperen en tellen is meer waard dan honderd losse zinnen.
   `spoed` bepaalt hoe snel een verzoek "oud" heet, en dat verschilt echt: een
   servetje mag wachten, "er is iets mis" niet. */
const SOORTEN = {
  bediening: { naam: 'Kunt u even komen?', oudNa: 5 },
  rekening: { naam: 'De rekening graag', oudNa: 7 },
  water: { naam: 'Nog wat water', oudNa: 10 },
  bestek: { naam: 'Bestek of servetten', oudNa: 10 },
  afruimen: { naam: 'Mag dit weg?', oudNa: 12 },
  hulp: { naam: 'Er is iets niet goed', oudNa: 3 }
};
const STANDEN = ['open', 'opgepakt', 'klaar', 'ingetrokken'];

module.exports = ({ save, schoon, horeca }) => {
  const { H, nu, id } = horeca;
  const minutenSinds = (at) => at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0;

  const V = (zaakcode) => {
    const h = H(zaakcode);
    if (!Array.isArray(h.verzoeken)) h.verzoeken = [];
    return h.verzoeken;
  };

  /* Hoe een verzoek eruitziet voor wie het leest. De leeftijd wordt hier
     gerekend en niet opgeslagen: een opgeslagen "minuten open" is vanaf de
     volgende seconde onwaar. */
  function beeld(v) {
    const soort = SOORTEN[v.soort] || { naam: v.soort, oudNa: 10 };
    const min = minutenSinds(v.stand === 'open' ? v.at : (v.opgepaktAt || v.at));
    return { id: v.id, soort: v.soort, naam: soort.naam, tekst: v.tekst || null,
      tafel: v.tafel, rekeningId: v.rekeningId, door: v.door, stand: v.stand,
      at: v.at, minuten: min, oud: v.stand === 'open' && min >= soort.oudNa,
      opgepaktDoor: v.opgepaktDoor || null, afgehandeldAt: v.afgehandeldAt || null };
  }

  /* ---------- de gast vraagt ----------
     Eén open verzoek per soort per rekening. Twee keer op dezelfde knop
     drukken is niet twee keer vragen: dat maakt de wachtrij van de zaak
     onleesbaar precies wanneer het druk is, en dan lijdt de gast die één keer
     drukte onder de gast die tien keer drukte. */
  function vraag(zaakcode, rekening, deelnemer, { soort, tekst }) {
    const s = String(soort || '');
    if (!SOORTEN[s]) return { status: 400, error: 'Dat kunnen we hier niet vragen.', code: 'soort',
      soorten: lijstVoorGast() };
    const lijst = V(zaakcode);
    const al = lijst.find(v => v.rekeningId === rekening.id && v.soort === s
      && (v.stand === 'open' || v.stand === 'opgepakt'));
    if (al) return { ok: true, verzoek: beeld(al), alGevraagd: true,
      let: 'Dit stond al open; we hebben er niet nog een van gemaakt.' };

    const v = { id: id(4), soort: s, tekst: schoon(tekst, 140) || null,
      rekeningId: rekening.id, tafel: rekening.tafel || null,
      /* De handle van de deelnemer en niet zijn naam of sleutel: de bediening
         hoeft te weten wie het vroeg om hem aan te kunnen spreken, en verder
         niets (CLAUDE.md, privacy by design). */
      door: (deelnemer && deelnemer.handle) || 'Gast',
      stand: 'open', at: nu() };
    lijst.push(v);
    if (lijst.length > 400) h_snoei(zaakcode);
    save();
    return { ok: true, verzoek: beeld(v) };
  }

  // afgehandelde verzoeken van eerdere dagen mogen weg; open verzoeken nooit
  function h_snoei(zaakcode) {
    const h = H(zaakcode);
    h.verzoeken = h.verzoeken.filter(v => v.stand === 'open' || v.stand === 'opgepakt'
      || minutenSinds(v.afgehandeldAt || v.at) < 60 * 24);
  }

  /* De gast mag zijn eigen verzoek intrekken -- hij heeft het per ongeluk
     aangeraakt, of het is al opgelost doordat er toevallig iemand langsliep.
     Alleen zijn eigen, en alleen zolang niemand het heeft opgepakt: daarna is
     er een medewerker onderweg en is intrekken een mededeling, geen knop. */
  function trekIn(zaakcode, rekening, verzoekId) {
    const v = V(zaakcode).find(x => x.id === String(verzoekId || '') && x.rekeningId === rekening.id);
    if (!v) return { status: 404, error: 'Dit verzoek kennen we niet.' };
    if (v.stand === 'opgepakt') return { status: 409,
      error: 'Er is al iemand mee bezig; zeg het even tegen de medewerker die komt.', code: 'onderweg' };
    if (v.stand !== 'open') return { status: 409, error: 'Dit verzoek is al afgehandeld.' };
    v.stand = 'ingetrokken';
    v.afgehandeldAt = nu();
    save();
    return { ok: true, verzoek: beeld(v) };
  }

  // wat de gast van zijn eigen tafel ziet
  const mijne = (zaakcode, rekening) => V(zaakcode)
    .filter(v => v.rekeningId === rekening.id && v.stand !== 'ingetrokken')
    .slice(-20).map(beeld);

  const lijstVoorGast = () => Object.entries(SOORTEN).map(([sleutel, o]) => ({ sleutel, naam: o.naam }));

  /* ---------- de zaak ziet en handelt af ----------
     Gesorteerd op oud-eerst en dan op leeftijd. Niet op tafelnummer: een
     wachtrij die op volgorde van de zaal staat, laat de tafel die het langst
     wacht onderaan staan als hij toevallig hoog genummerd is. */
  function wachtrij(zaakcode) {
    const rijen = V(zaakcode).filter(v => v.stand === 'open' || v.stand === 'opgepakt').map(beeld);
    rijen.sort((a, b) => (b.oud ? 1 : 0) - (a.oud ? 1 : 0) || b.minuten - a.minuten);
    return { aantal: rijen.length, oud: rijen.filter(r => r.oud).length, verzoeken: rijen,
      let: 'De minuten zijn een feit; er staat nergens een belofte over hoe snel iemand er is.' };
  }

  function zet(zaakcode, verzoekId, stand, wie) {
    const v = V(zaakcode).find(x => x.id === String(verzoekId || ''));
    if (!v) return { status: 404, error: 'Dit verzoek kennen we niet.' };
    const s = String(stand || '');
    if (!['opgepakt', 'klaar'].includes(s)) return { status: 400, error: 'Kies: opgepakt of klaar.' };
    if (v.stand === 'klaar' || v.stand === 'ingetrokken')
      return { status: 409, error: 'Dit verzoek is al afgehandeld (' + v.stand + ').' };
    v.stand = s;
    if (s === 'opgepakt') { v.opgepaktAt = nu(); v.opgepaktDoor = schoon(wie, 40) || null; }
    else { v.afgehandeldAt = nu(); v.afgehandeldDoor = schoon(wie, 40) || null; }
    save();
    return { ok: true, verzoek: beeld(v) };
  }

  return { SOORTEN, STANDEN, beeld, vraag, trekIn, mijne, lijstVoorGast, wachtrij, zet };
};
