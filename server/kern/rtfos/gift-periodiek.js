/* Foundation OS, deel "gift-periodiek": de meerjarige schenkingsafspraak.

   EEN PERIODIEKE GIFT IS GEEN GIFT MET EEN VINKJE. Hij stond dat wel te zijn:
   ./donateur.js hangt `periodiek` aan EEN bron -- aan een enkele gift dus --
   terwijl de afspraak over vijf jaar en vijf bedragen gaat. Wat er dan niet is:
   de volgende termijn, de vraag of er al betaald is, en wat er gebeurt als
   iemand stopt. Dit deel maakt er een PLAN van, met de termijnen eronder, en
   elke betaalde termijn wijst terug naar de bron die eruit ontstond.

   VIER GRENDELS:

   1. VIJF JAAR IS DE ONDERGRENS, en die staat op EEN plek (./gift-vormen.js).
      Hij stond hier bijna een tweede keer; twee plekken met hetzelfde getal
      lopen uiteen (LAT.md regel 4).

   2. HET BEDRAG STAAT VAST. Een periodieke gift is een vast jaarbedrag; een
      plan waarvan het bedrag per jaar mag bewegen, is geen periodieke gift meer.
      Wijzigen kan niet -- stoppen en opnieuw voorstellen wel, en dat is een
      andere handeling met een ander gevolg.

   3. EEN MENS VAN DE STICHTING LEGT HEM VAST. Een voorstel van een gever is nog
      geen overeenkomst: er hoort een vindbaar stuk bij met een kenmerk. Tot dat
      moment is elke betaling gewoon een gift, en dat zegt het plan ook.

   4. ER IS GEEN INCASSO EN DIE KOMT ER NIET UIT ZICHZELF. Elke termijn wordt
      door de gever zelf bevestigd, langs dezelfde weg als een gewone gift. Geld
      dat vanzelf van iemands rekening gaat, vraagt een eigen besluit en een
      machtiging (GIFT.md par. 5).

   EN DE AFTREKBAARHEID VOLGT DE ANBI-STAND. Dat is hier geen detail: de oude
   zin in ./donateur.js zei bij het vastleggen onvoorwaardelijk "aftrekbaar
   zonder drempel", en dat klopt alleen als de stichting een ANBI IS. Zolang de
   aanvraag loopt, is die zin een belofte die de gever bij zijn aangifte geld
   kost. Wat hier uit komt, zegt wat er op dat moment vaststaat. */
'use strict';

const { JAREN_MIN, anbiZin } = require('./gift-vormen');

const STANDEN = ['voorgesteld', 'vastgelegd', 'gestopt'];

module.exports = (ctx, { standVan }) => {
  const { nu, rid, schoon, S, audit, naarCenten, euro, save } = ctx;

  const P = () => {
    const s = S();
    if (!Array.isArray(s.giftplannen)) s.giftplannen = [];
    return s.giftplannen;
  };

  const jaarVan = d => Number(String(d || '').slice(0, 4)) || null;

  /* Wat de gever van zijn plan ziet. De termijnen worden AFGELEID uit het
     startjaar en het aantal jaren, en niet als rij bewaard: een bewaarde rij die
     naast de looptijd komt te staan, is een tweede waarheid over hetzelfde. */
  function beeld(p) {
    const startJaar = jaarVan(p.at);
    const termijnen = [];
    for (let i = 0; i < p.jaren; i++) {
      const jaar = startJaar + i;
      const betaald = p.betaald.find(b => b.jaar === jaar) || null;
      termijnen.push({ jaar, euro: euro(p.centenPerJaar),
        voldaan: !!betaald, bron: betaald ? betaald.bron : null, at: betaald ? betaald.at : null });
    }
    /* WELKE TERMIJN VANDAAG OPENSTAAT, en dat rekent de server uit en niet het
       scherm. Zonder dit stond er een knop "termijn van dit jaar geven" zolang
       er ergens nog een jaar open was -- ook als dit jaar al voldaan was. Dan
       betaalt iemand wel en wordt er niets afgetekend, want termijnAf() kijkt
       naar het HUIDIGE jaar. Geld weg, termijn open: de vervelendste combinatie. */
    const ditJaar = jaarVan(nu());
    const vanDitJaar = termijnen.find(t => t.jaar === ditJaar) || null;
    return { id: p.id, stand: p.stand, jaren: p.jaren, euroPerJaar: euro(p.centenPerJaar),
      kenmerk: p.kenmerk || null, tot: p.tot || null, gestoptOm: p.gestoptOm || null,
      termijnen, ditJaar,
      openDitJaar: !!vanDitJaar && !vanDitJaar.voldaan && p.stand !== 'gestopt',
      /* Wat dit plan VANDAAG waard is voor de aangifte van de gever. Niet wat
         het straks misschien wordt: zie de kop. */
      aftrekbaar: p.stand === 'vastgelegd' && standVan().anbi === 'ja',
      zegt: zinnen(p) };
  }

  function zinnen(p) {
    const anbi = standVan().anbi;
    const uit = [];
    if (p.stand === 'voorgesteld') {
      uit.push('Dit is nog een voorstel. Een periodieke gift bestaat pas als de stichting de overeenkomst heeft vastgelegd; tot die tijd is elke betaling een gewone gift.');
    }
    if (p.stand === 'gestopt') {
      uit.push('Dit plan is gestopt. Wat er al betaald is, blijft staan; er wordt niets meer verwacht.');
    }
    if (p.stand === 'vastgelegd') {
      uit.push('De overeenkomst is vastgelegd onder kenmerk ' + p.kenmerk + ', tot ' + p.tot + '.');
    }
    uit.push(anbiZin(anbi, standVan().rsin, 'periodiek'));
    uit.push('Er wordt niets automatisch afgeschreven. Elke termijn bevestig je zelf.');
    return uit;
  }

  /* ---------- de gever ---------- */
  function voorstel(codenaam, b) {
    b = b || {};
    const ik = schoon(codenaam, 40);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    const g = standVan();
    if (g.stand !== 'open') return { status: 409, error: 'RTG neemt op dit moment geen giften aan.' };
    if (!(g.vormen || []).includes('periodiek')) {
      return { status: 409, error: 'De periodieke gift staat niet open.' };
    }
    const centen = naarCenten(b.euroPerJaar);
    if (!centen) return { status: 400, error: 'Welk bedrag geef je per jaar?' };
    const jaren = Math.round(Number(b.jaren) || 0);
    if (jaren < JAREN_MIN) {
      return { status: 400, error: 'Een periodieke gift loopt ten minste ' + JAREN_MIN + ' jaar. Korter kan, maar dan is het een gewone gift met een drempel.' };
    }
    if (P().filter(x => x.codenaam === ik && x.stand !== 'gestopt').length >= 5) {
      return { status: 429, error: 'Je hebt er al vijf lopen. Stop er eerst een.' };
    }
    const p = { id: rid(), codenaam: ik, stand: 'voorgesteld', jaren,
      centenPerJaar: centen, betaald: [], kenmerk: null, tot: null, at: nu() };
    P().push(p);
    audit(ik, 'giftplan.voorstel', p.id, euro(centen) + ' euro per jaar, ' + jaren + ' jaar');
    save();
    return { ok: true, plan: beeld(p) };
  }

  function mijn(codenaam) {
    const ik = schoon(codenaam, 40);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    return { ok: true, plannen: P().filter(x => x.codenaam === ik).map(beeld) };
  }

  function stop(codenaam, b) {
    b = b || {};
    const ik = schoon(codenaam, 40);
    const p = P().find(x => x.id === String((b || {}).id || ''));
    if (!p) return { status: 404, error: 'Dit plan bestaat niet.' };
    if (!ik || p.codenaam !== ik) return { status: 403, error: 'Dit plan is niet van jou.' };
    if (p.stand === 'gestopt') return { status: 409, error: 'Dit plan is al gestopt.' };
    p.stand = 'gestopt';
    p.gestoptOm = schoon(b.reden, 200) || null;
    audit(ik, 'giftplan.stop', p.id, p.gestoptOm || '');
    save();
    /* WAT HIER NIET STAAT: of stoppen juridisch mag en wat het betekent voor
       eerder afgetrokken bedragen. Dat is een vraag aan de Belastingdienst en
       aan de overeenkomst zelf, en dit systeem gaat er niet over. */
    return { ok: true, plan: beeld(p),
      melding: 'Gestopt. Wat je al gaf blijft staan. Wat een gestopte overeenkomst betekent voor je aangifte, staat in de overeenkomst zelf -- daar gaan wij niet over.' };
  }

  /* Een betaalde termijn aantekenen. Wordt door ./gift-betalen.js aangeroepen
     NA een geslaagde boeking; dit deel int niets. */
  function termijnAf(codenaam, planId, bronId) {
    const p = P().find(x => x.id === String(planId || ''));
    if (!p || p.codenaam !== codenaam) return null;
    const jaar = jaarVan(nu());
    /* NULL en niet het plan: de aanroeper meldt anders een termijn die hij niet
       heeft afgetekend, en dan staat er "termijn voldaan" bij een betaling die
       er geen was. */
    if (p.betaald.some(x => x.jaar === jaar)) return null;
    p.betaald.push({ jaar, bron: bronId || null, at: nu() });
    save();
    return p;
  }

  /* ---------- de stichting ---------- */
  function lijst() {
    return { ok: true, plannen: P().slice(0, 500).map(p => Object.assign(beeld(p), { gever: p.codenaam })) };
  }

  function vastleggen(b, wie) {
    b = b || {};
    const p = P().find(x => x.id === String(b.id || ''));
    if (!p) return { status: 404, error: 'Dit plan bestaat niet.' };
    if (p.stand === 'gestopt') return { status: 409, error: 'Dit plan is gestopt.' };
    const kenmerk = schoon(b.kenmerk, 60);
    if (!kenmerk) return { status: 400, error: 'Wat is het kenmerk van de overeenkomst? Zonder vindbaar stuk is er niets vastgelegd.' };
    const tot = schoon(b.tot, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tot)) return { status: 400, error: 'Tot wanneer loopt de overeenkomst?' };
    p.stand = 'vastgelegd';
    p.kenmerk = kenmerk;
    p.tot = tot;
    p.door = schoon(wie, 60) || 'kantoor';
    audit(p.door, 'giftplan.vastgelegd', p.id, kenmerk + ' tot ' + tot);
    save();
    return { ok: true, plan: beeld(p) };
  }

  return { voorstel, mijn, stop, termijnAf, lijst, vastleggen, beeld, STANDEN };
};
module.exports.STANDEN = STANDEN;
