/* RTG Pay, deelbestand "tegoed": een lid koopt tegoed voor iemand anders.

   Waarom dit naast ./verzoeken.js staat en er geen variant van is: een Klompje
   VRAAGT geld van iemand die het nog heeft, dit ZET geld vast dat de koper al
   heeft. Dat verschil zit in het grootboek en niet in de woorden -- een
   Klompje verplaatst pas iets als de ander betaalt, een tegoed verplaatst
   meteen en de ontvanger is dan nog niet bekend.

   DE ESCROW-REKENING. Gekocht tegoed staat op 'extern:tegoed' tot iemand het
   verzilvert. Dat is dezelfde soort huisrekening als 'extern:treasury' en
   'extern:uitbetaald': buiten de wallets, want het is op dat moment van
   niemands wallet. Wat er open staat is daarmee ook zichtbaar als EEN bedrag
   (het saldo van die rekening) in plaats van als een som die je zelf moet
   maken -- en de sluitcontrole telt hem gewoon mee.

   HET GROOTBOEK BEWAAKT DIT STUK NIET. boek() slaat de saldocontrole over voor
   elke rekening die met 'extern:' begint (zie ./index.js) -- dat MOET, want de
   kaart-naad en de bank leveren daar geld aan dat nog niet in het stelsel zit.
   Gevolg: het grootboek weigert niet als er meer uit de escrow gehaald wordt
   dan erin zit. Wat dat tegenhoudt is de STAAT PER BON hieronder, en niets
   anders. Vandaar dat elke overgang de bon eerst synchroon claimt en pas
   daarna boekt: tussen de controle en de boeking zit een await, en twee tikken
   in dat gaatje zouden dezelfde bon twee keer verzilveren.

   WAT DIT NIET IS. Geen bestemming ("alleen voor Reizen"): dat vraagt een
   tweede saldo-dimensie in het grootboek, want zodra tegoed is verzilverd is
   het gewoon walletsaldo en dus inwisselbaar voor alles. Zie TOKEN.md; het
   half doen zou een belofte op het scherm zetten die de boeking niet waarmaakt.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

const moneyCredentialBlokkade = require('../../middleware/money-credential-productiepoort').blokkade;

module.exports = (ctx) => {
  const { crypto, save, schoon, nu, d, rekLid, saldoVan, id, metIdem, boekAsync,
    zorgSaldo, seintje, bestaatLid, MIN_CENTEN, MAX_CENTEN } = ctx;

  /* De bon zelf -- zijn vorm, zijn code en hoe hij wordt opgeborgen -- staat in
     ./tegoed-bon.js, want dat is precies het stuk dat NIET verschilt tussen een
     lid en een zaak. */
  const bon = require('./tegoed-bon')({ d, save, crypto, nu });
  const { REK_TEGOED, VERVAL_MS, bonnen, bewaar, nieuweCode, normaliseer, naarBuiten } = bon;

  /* ---------- kopen: geld uit de wallet, vast op de escrow ---------- */
  async function tegoedKoop({ codenaam, centen, aanCodenaam, oms, idem }) {
    const dicht = moneyCredentialBlokkade('pay.tegoedbon');
    if (dicht) return dicht;
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    const aan = schoon(aanCodenaam, 40) || null;
    /* Een gericht tegoed voor een codenaam die niet bestaat is geld dat niemand
       ooit kan ophalen. Dat hoort een 404 te zijn en geen bon. */
    if (aan && !(await bestaatLid(aan))) return { status: 404, error: 'Die codenaam kennen we niet.' };
    if (aan && aan === codenaam) return { status: 400, error: 'Tegoed voor jezelf is gewoon je saldo.' };
    return metIdem(idem ? 'tegoedkoop:' + codenaam + ':' + idem : null,
      'tegoedkoop|' + codenaam + '|' + c + '|' + (aan || ''), async () => {
        const z = await zorgSaldo({ codenaam, centen: c, idem });
        if (z.error) return z;
        const b = await boekAsync({ van: rekLid(codenaam), naar: REK_TEGOED, centen: c, soort: 'tegoed', oms: oms || 'Tegoed gekocht' });
        if (b.error) return b;
        const t = {
          id: id('TG'), code: nieuweCode(), van: codenaam, vanSoort: 'lid', aan, centen: c,
          oms: schoon(oms, 80) || 'Tegoed', status: 'open',
          at: nu(), vervalt: nu() + VERVAL_MS, boeking: b.boeking.id
        };
        bewaar(t);
        if (aan) seintje(aan);
        return { ok: true, tegoed: naarBuiten(t), saldo: saldoVan(rekLid(codenaam)), bijgeladen: z.bijgeladen };
      }, { geld: 'koopt tegoed, en dat is een betaling' });
  }

  /* ---------- verzilveren: van de escrow naar de wallet van de ontvanger ---------- */
  async function tegoedVerzilver({ codenaam, code, idem }) {
    const dicht = moneyCredentialBlokkade('pay.tegoedbon');
    if (dicht) return dicht;
    const gezocht = normaliseer(code);
    if (!gezocht) return { status: 400, error: 'Vul de tegoedcode in.' };
    const t = bonnen().find(x => normaliseer(x.code) === gezocht);
    /* Onbekend en al-gebruikt krijgen met opzet VERSCHILLENDE antwoorden: wie
       een bon in handen heeft die op is, hoort te kunnen begrijpen waarom hij
       niets krijgt. Dat lekt of een code bestaat, en dat mag hier: wie codes
       wil raden heeft aan 96 bits genoeg te doen. */
    if (!t) return { status: 404, error: 'Deze tegoedcode kennen we niet.' };
    if (t.status !== 'open') return { status: 409, error: 'Dit tegoed is al gebruikt.' };
    if (t.aan && t.aan !== codenaam) return { status: 403, error: 'Dit tegoed staat op naam van iemand anders.' };
    if (t.vervalt < nu()) return { status: 409, error: 'Dit tegoed is verlopen; de koper kan het terugnemen.' };
    return metIdem(idem ? 'tegoedin:' + codenaam + ':' + idem : null,
      'tegoedin|' + codenaam + '|' + t.id, async () => {
        /* Synchroon claimen vóór de await; zie de kop van dit bestand. BEWUST
           ZONDER save(): dit is een slot in het geheugen tegen twee tikken in
           hetzelfde proces, geen staat die een herstart hoort te overleven.
           Zou 'bezig' wél op schijf landen en het proces daarna sterven, dan
           staat de bon voor altijd op een stand die noch verzilverd noch
           teruggenomen kan worden -- en het geld voor altijd in de escrow. Wat
           er wel duurzaam moet landen, landt hieronder, in dezelfde bundel als
           de boeking (lib/idem.js). */
        t.status = 'bezig';
        const b = await boekAsync({ van: REK_TEGOED, naar: rekLid(codenaam), centen: t.centen, soort: 'tegoed', oms: t.oms, ref: t.id });
        if (b.error) { t.status = 'open'; return b; }
        t.status = 'verzilverd';
        t.verzilverdDoor = codenaam;
        t.verzilverdAt = nu();
        save();
        // Alleen een LID krijgt een seintje: bij een zaak-bon staat in `van` een
        // zaakcode, en die is geen codenaam -- seintje zou daar niemand vinden.
        if (t.vanSoort !== 'zaak') seintje(t.van);
        return { ok: true, centen: t.centen, saldo: saldoVan(rekLid(codenaam)), tegoed: naarBuiten(t) };
      });
  }

  /* ---------- terugnemen: verlopen tegoed gaat terug naar de KOPER ----------
     En niet naar RTG. Niet-opgehaald tegoed dat in huis blijft, is inkomen dat
     ontstaat doordat iemand iets vergat -- dat is precies het patroon dat
     CLAUDE.md verbiedt. Het gebeurt bovendien niet vanzelf: een leesactie die
     geld verplaatst bestaat hier niet, en GELD.md par. 3 laat alleen INTERNE
     reserveringen automatisch lopen. De koper drukt zelf. */
  async function tegoedTerug({ codenaam, tegoedId, idem }) {
    const dicht = moneyCredentialBlokkade('pay.tegoedbon');
    if (dicht) return dicht;
    const t = bonnen().find(x => x.id === String(tegoedId || '') && x.vanSoort !== 'zaak' && x.van === codenaam);
    if (!t) return { status: 404, error: 'Dit tegoed is niet van jou.' };
    if (t.status !== 'open') return { status: 409, error: 'Dit tegoed staat niet meer open.' };
    if (t.vervalt >= nu()) return { status: 409, error: 'Dit tegoed loopt nog; terugnemen kan pas na de vervaldatum.' };
    return metIdem(idem ? 'tegoedterug:' + codenaam + ':' + idem : null,
      'tegoedterug|' + codenaam + '|' + t.id, async () => {
        t.status = 'bezig';   // in het geheugen; zie tegoedVerzilver waarom niet op schijf
        const b = await boekAsync({ van: REK_TEGOED, naar: rekLid(codenaam), centen: t.centen, soort: 'tegoed', oms: 'Verlopen tegoed terug', ref: t.id });
        if (b.error) { t.status = 'open'; return b; }
        t.status = 'terug';
        t.terugAt = nu();
        save();
        return { ok: true, centen: t.centen, saldo: saldoVan(rekLid(codenaam)), tegoed: naarBuiten(t) };
      });
  }

  /* ---------- wat het lid ziet ----------
     De code van een gekocht tegoed blijft zichtbaar voor de koper (die moet hem
     immers doorgeven) en verdwijnt zodra hij verzilverd is. Wat aan het lid
     GERICHT is, staat er zonder dat er een code overgetikt hoeft te worden. */
  function tegoedOverzicht(codenaam) {
    const dicht = moneyCredentialBlokkade('pay.tegoedbon');
    if (dicht) return dicht;
    const alle = bonnen();
    const gekocht = alle.filter(t => t.vanSoort !== 'zaak' && t.van === codenaam).slice(0, 50).map(t => {
      const r = naarBuiten(t);
      if (r.status !== 'open') r.code = null;
      return r;
    });
    const voorMij = alle.filter(t => t.aan === codenaam && t.status === 'open').slice(0, 50).map(naarBuiten);
    const openCenten = gekocht.filter(t => t.status === 'open').reduce((s, t) => s + t.centen, 0);
    return { ok: true, gekocht, voorMij, openCenten, vervalDagen: Math.round(VERVAL_MS / 86400000) };
  }

  /* De ZAAKKANT staat in ./tegoed-zaak.js. Niet omdat hij anders werkt -- het is
     dezelfde bon, dezelfde escrow en dezelfde vervaldatum -- maar omdat de
     betaler een ander soort rekening is: een zaak heeft geen autolaad (zijn
     saldo is echte omzet) en geen codenaam. Die twee verschillen bij elke
     functie apart afvangen, zou van elke functie een vork maken. */
  return Object.assign({ tegoedKoop, tegoedVerzilver, tegoedTerug, tegoedOverzicht },
    require('./tegoed-zaak')(ctx, bon));
};
