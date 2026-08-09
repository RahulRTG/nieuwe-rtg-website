/* Overheid-domein "naheffing" (deelmodule): BETALEN, EN TERUGBETALEN.

   Dit is het stuk waarvan hier drie commits lang stond dat het er NIET was, met
   de reden erbij: een `betaald = true` zonder boeking is een leugen in de
   database. Dus gebeurt het nu zoals het hoort, of het gebeurt niet.

   ER BEWEEGT ECHT GELD. De betaling is een dubbele boeking in het grootboek van
   RTG Bank (kern/bank/grootboek.js): van de zakelijke rekening van de zaak naar
   `extern:belastingdienst`. Dat is de eerlijke tegenrekening -- de
   Belastingdienst bankiert niet bij RTG, dus het geld verlaat het platform, en
   `extern:` is precies de kant die dat in dit grootboek betekent. De som van
   alle saldi blijft exact nul; dat bewaakt de bank zelf.

   DE VOLGORDE IS DE HELE ZAAK. Eerst boeken, dan pas de naheffing op betaald
   zetten. Andersom zou een mislukte boeking een betaalde naheffing opleveren, en
   dat is het ergste van de twee: dan denkt iedereen dat het klaar is. Gaat het
   tussen die twee stappen mis (het proces valt om), dan staat de boeking met het
   KENMERK als referentie in het grootboek en is hij terug te vinden; er is dan
   te veel geboekt en te weinig vastgelegd, en dat is de kant die je kunt
   repareren.

   TERUGBETALEN HOORT ERBIJ. Wordt een bezwaar toegewezen tegen een naheffing die
   al betaald is, dan moet het geld terug. Een besluit dat de aanslag vernietigt
   en het bedrag laat staan, is een besluit dat niets doet.

   WAT ER NOG STEEDS NIET IS: aanmanen, invorderen, beslag. Betaalt een zaak
   niet, dan blijft de naheffing openstaan met zijn vervaldatum. Dat is een eigen
   onderwerp met eigen bevoegdheden.

   Krijgt de gedeelde ctx van kern/overheid/index.js. */
'use strict';

const NAAR = 'extern:belastingdienst';

module.exports = (ctx, { vind, publiek }) => {
  const { db, save, nu, schoon, notifySupplier, bankLive, bankBoek, bankSaldo } = ctx;
  const euro = (centen) => (centen / 100).toFixed(2).replace('.', ',');
  /* Wat er te betalen is: de aanslag, de boete EN de invorderingskosten die er
     onderweg bij zijn gekomen (./naheffing-invordering.js). Een aanmaning die
     kosten oplegt maar het te betalen bedrag niet meebeweegt, laat de zaak te
     weinig overmaken en houdt de invordering aan de gang om acht euro. */
  const teBetalen = (n) => n.naheffingCenten + n.boeteCenten + (n.kostenCenten || 0);

  /* De zakelijke rekening van een zaak. Dezelfde vlag als waaronder
     routes/bankhart.js hem opent ('zaak:<code>'); die twee moeten hetzelfde
     zeggen, anders betaalt een zaak van een rekening die hij nergens ziet. */
  function rekeningVan(code) {
    const vlag = 'zaak:' + String(code || '').toUpperCase();
    return Object.values(db.data.bankRekeningen || {})
      .find(r => r.codenaam === vlag && r.soort === 'zakelijk') || null;
  }

  /* Kan er uberhaupt geld bewegen? Drie redenen van niet, en alle drie worden ze
     met zoveel woorden gezegd: geen bank in dit proces, de leden-bank staat nog
     dicht, of de zaak heeft zijn zakelijke rekening nooit geopend. */
  function betaalweg(code) {
    if (!bankLive || !bankLive()) return { status: 503,
      error: 'De RTG Bank is nog niet live; betalen kan pas als de boardroom hem openzet. Er is niets afgeschreven.' };
    const rek = rekeningVan(code);
    if (!rek) return { status: 409,
      error: 'Deze zaak heeft nog geen zakelijke rekening. Open hem in het Kantoor onder Boekhouding en probeer het opnieuw.' };
    return { ok: true, rek };
  }

  /* ---- betalen ---- */
  async function naheffingBetaal(code, id) {
    const n = vind(id);
    if (!n || n.code !== String(code || '').toUpperCase())
      return { status: 404, error: 'Deze naheffing kennen we niet.' };
    if (n.betaaldOp) return { status: 409, error: 'Deze naheffing is al betaald op ' + String(n.betaaldOp).slice(0, 10) + '.' };
    if (!['vastgesteld', 'bezwaar', 'gehandhaafd'].includes(n.status)) return { status: 409,
      error: n.status === 'concept' ? 'Deze naheffing is nog een concept en dus geen besluit; er valt niets te betalen.'
        : 'Een naheffing met de stand "' + n.status + '" hoeft niet te worden betaald.' };
    /* Min wat er al binnen is: na een DEELBESLAG staat er nog een rest open, en
       die -- en niet het hele bedrag -- is wat de zaak nu overmaakt. */
    const bedrag = teBetalen(n) - (n.betaalCenten || 0);
    if (bedrag <= 0) return { status: 409, error: 'Er staat niets open op deze naheffing.' };

    const weg = betaalweg(n.code);
    if (weg.error) return weg;
    const saldo = bankSaldo(weg.rek.iban);
    if (saldo < bedrag) return { status: 402,
      error: 'Er staat € ' + euro(saldo) + ' op de zakelijke rekening en de naheffing is € ' + euro(bedrag) +
        '. Er is € ' + euro(bedrag - saldo) + ' te weinig; er is niets afgeschreven.' };

    /* EERST BOEKEN. Faalt dit, dan is er niets veranderd -- niet aan het geld en
       niet aan de naheffing. De bank bewaakt zelf de bodem en de dubbele
       boeking; wat hij weigert, weigeren wij ook, met zijn eigen tekst. */
    const b = await bankBoek({ van: weg.rek.iban, naar: NAAR, centen: bedrag,
      soort: 'belasting', oms: 'Naheffing omzetbelasting ' + n.periode, ref: n.kenmerk });
    if (b && b.error) return b;

    n.betaaldOp = nu();
    n.betaalIban = weg.rek.iban;
    n.betaalCenten = (n.betaalCenten || 0) + bedrag;
    save();
    return { ok: true, naheffing: publiek(n),
      let: 'Betaald: € ' + euro(bedrag) + ' is van uw zakelijke rekening afgeschreven naar de Belastingdienst.' };
  }

  /* ---- terugbetalen ----
     Alleen aangeroepen vanuit het besluit op bezwaar (./naheffing-daarna.js), en
     alleen als er echt is betaald. Geeft een tekst terug die daar bij het besluit
     wordt gemeld; lukt de terugboeking niet, dan zegt hij dat ook -- het besluit
     zelf staat dan wel, want een vernietigde aanslag blijft vernietigd ook als
     het geld nog onderweg is. */
  async function naheffingTerugbetaal(n) {
    if (!n || !n.betaaldOp || n.terugbetaaldOp) return null;
    if (!bankLive || !bankLive()) return 'Let op: er is € ' + euro(n.betaalCenten) +
      ' betaald op deze naheffing en de bank staat niet open, dus het geld is nog niet terug.';
    const b = await bankBoek({ van: NAAR, naar: n.betaalIban, centen: n.betaalCenten,
      soort: 'belasting', oms: 'Terugbetaling naheffing ' + n.periode, ref: n.kenmerk });
    if (b && b.error) return 'Let op: de terugbetaling van € ' + euro(n.betaalCenten) +
      ' lukte niet (' + b.error + '); het besluit staat wel.';
    n.terugbetaaldOp = nu();
    save();
    if (notifySupplier) notifySupplier(n.code, { icon: 'overheid', title: 'Naheffing terugbetaald',
      body: n.kenmerk + ': € ' + euro(n.betaalCenten) + ' is teruggestort op uw zakelijke rekening.', scope: 'overheid' });
    return 'De betaalde € ' + euro(n.betaalCenten) + ' is teruggestort op de zakelijke rekening van de zaak.';
  }

  /* Wat een zaak op dit moment openstaan heeft. Los leesbaar, zodat het scherm
     er niet zelf een som van hoeft te maken. */
  function naheffingOpenstaand(code) {
    const c = String(code || '').toUpperCase();
    const open = (db.data.rijkNaheffingen || []).filter(n => n.code === c && !n.betaaldOp &&
      ['vastgesteld', 'bezwaar', 'gehandhaafd'].includes(n.status));
    return { ok: true, aantal: open.length,
      centen: open.reduce((s, n) => s + teBetalen(n) - (n.betaalCenten || 0), 0),
      kenmerken: open.map(n => n.kenmerk) };
  }

  return { naheffingBetaal, naheffingTerugbetaal, naheffingOpenstaand,
    NAHEFFING_TEGENREKENING: NAAR, rekeningVan };
};
