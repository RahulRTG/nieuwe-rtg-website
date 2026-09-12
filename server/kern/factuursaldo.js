/* De maandfactuur betalen uit het eigen RTG Pay-saldo -- de derde betaalweg,
   naast de kaart (routes/member/betalen.js) en de munten (betalen-munt.js).

   De wallet kon alles betalen behalve het eigen lidmaatschap: de kassa, een
   pakket, een Klompje -- maar het belangrijkste terugkerende geldmoment van
   het huis liep verplicht over de kaart. Deze module dicht die naad met wat
   er al staat, en voegt bewust GEEN nieuwe geldweg toe:

   - de afschrijving loopt via pay.huisIn (lid -> huisrekening), met de
     idempotentie en de autolaad die daar al wonen; de idem-sleutel is hier
     deterministisch (wie + factuurnummer), dus een herhaald verzoek boekt
     nooit dubbel;
   - de afwikkeling loopt via settleFactuur (kern/settlement.js), DEZELFDE
     als voor de kaart- en muntbevestigingen. Daardoor gelden ook hier de
     bedragcontrole (te weinig = deelbetaling, factuur blijft open) en de
     30%-afdracht aan de RTFoundation, zonder dat die regels ergens een
     tweede keer staan.

   De betaalkern wordt pas na deze module gebouwd (kernlaag), vandaar payVan
   als late binding -- hetzelfde draadje als payOplaadAfronden in de
   settlement.

   EEN DUURZAME COMMIT VOOR ALLEBEI, EN WAAROM DAT HIER MOEST.

   Dit waren twee duurzame momenten: pay.huisIn legde boeking en idem-sleutel
   vast, en settleFactuur sloot daarna de factuur en boekte de afdracht. Tussen
   die twee zat een venster, en `npm run factuurproef` mat wat daarin gebeurt
   als het proces sterft (RTG_VERRAAD=sterf-na-commit, drie rondes, identieke
   uitslag): het saldo is afgeschreven, de factuur staat NOG OPEN en er is geen
   afdracht. Het lid heeft betaald voor niets.

   Dat geneest bij elke herhaling -- de sleutel overleefde, dus huisIn geeft
   dezelfde boeking terug en de afwikkeling loopt alsnog -- maar er is geen
   herstelronde die halve betalingen opruimt. Blijft de herhaling uit, dan
   blijft het staan.

   Nu opent deze module de bundel en doet pay.huisIn erin mee -- db/bijeen.js
   sluit sinds dezelfde ronde aan op een openstaande bundel die dezelfde
   belofte doet. Er is daarmee nog een duurzame commit en geen twee, dus de
   geslaagde afwikkeling staat als geheel op schijf. `bijeen` bundelt saves,
   maar draait mutaties niet terug wanneer werk of opslag een fout meldt.
   Een mislukte bevestiging zegt dus niet dat er niets is afgeschreven.

   Dit is de spiegel van de fout die GELDLAT.md in augustus weerlegde -- toen
   verdween het geld en klopte het grootboek, nu stond het geld vast en was de
   tegenprestatie zoek. Dezelfde oorzaak: twee dingen die bij elkaar horen in
   twee commits. */
function maakFactuurSaldo({ db, accounts, settleFactuur, payVan, broadcastSync, bijeen }) {
  const bezig = new Set();

  async function factuurSaldo({ own, accountId, wie, tier, codenaam, invoiceId }) {
    // dezelfde zekering als het kaartpad (routes/member/betalen.js): een
    // factuurbetaling die de boardroom stilzette, loopt ook hier niet door
    const zPay = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.betalingen;
    if (zPay && zPay.aan === false) return { status: 503, error: 'Betalen is tijdelijk uitgeschakeld.' };
    const pay = payVan && payVan();
    if (!pay) return { status: 503, error: 'De betaalkern is nog niet wakker; probeer het zo weer.' };
    const md = own ? accounts.getMemberState(accountId) : db.data;
    const inv = md && (md.invoices || []).find(i => i.id === String(invoiceId || ''));
    if (!inv) return { status: 404, error: 'Factuur niet gevonden.' };
    if (inv.status === 'paid') return { status: 409, error: 'Deze factuur is al betaald.' };
    // wat er nog openstaat: het gevraagde bedrag min wat er al als
    // deelbetaling binnenkwam (de muntweg kan een factuur half vullen)
    const centen = Math.round((inv.bijdrage || 0) * 100) - Math.round(inv.deelbetaald || 0);
    if (centen < 1) return { status: 409, error: 'Op deze factuur staat niets meer open.' };
    /* Twee gelijktijdige verzoeken lezen allebei "open" voordat de eerste
       heeft geboekt; de idem-sleutel vangt herhalingen, dit slot vangt de
       race binnen het proces (zelfde vorm als de in-vlucht-map van directpay). */
    const slot = wie + ':' + inv.id;
    if (bezig.has(slot)) return { status: 409, error: 'Deze betaling loopt al.' };
    bezig.add(slot);
    try {
      /* HET GELDPAD, IN EEN BUNDEL. `werk` staat los zodat de bundel er
         omheen kan en de code er zonder bundel exact hetzelfde uitziet --
         zonder `bijeen` gedraagt deze module zich als voorheen, en dat is
         geen vrijblijvendheid maar de reden dat de toetsen die hem los
         bouwen niet hoeven te weten wat een bundel is.

         De SEINTJES staan er bewust BUITEN (zie hieronder): een uitgaand
         bericht binnen een bundel vertelt iemand iets dat de opslag nog niet
         heeft bevestigd. */
      let uit = null;
      const werk = async () => {
        const b = await pay.huisIn({
          vanCodenaam: codenaam, centen,
          oms: 'RTG factuur ' + inv.id,
          idem: wie + ':inv-saldo:' + inv.id
        });
        if (b.error) { uit = b; return; }
        const s = await settleFactuur(
          { soort: 'factuur', wie, invoiceId: inv.id, own, accountId },
          { id: 'pay:' + b.boeking, centen: b.centen, hoe: 'Betaald uit RTG Pay-saldo' });
        /* Een mislukte afwikkeling mag geen geslaagd antwoord geven. De worp
           betekent geen rollback: bijeen kan eerdere saves nog vastleggen. */
        if (s && s.error) { uit = s; throw new Error('[factuursaldo] afwikkeling mislukt: ' + s.error); }
        uit = { ok: true, betaald: b.centen, bijgeladen: b.bijgeladen || 0 };
      };
      if (typeof bijeen === 'function') {
        try { await bijeen(werk, { duurzaam: true }); }
        catch (e) {
          /* Geen bevestiging is geen bewijs dat er niets is geboekt. De opslag
             kan de mutatie al hebben ontvangen voordat zij een fout meldt. */
          return uit && uit.error ? uit
            : { status: 503, error: 'De betaling kon niet worden bevestigd. Controleer de betaalstatus voordat je het opnieuw probeert.' };
        }
      } else await werk();
      if (uit && uit.error) return uit;
      if (broadcastSync && tier) broadcastSync([tier], 'payments');
      return uit;
    } finally { bezig.delete(slot); }
  }

  return { factuurSaldo };
}

module.exports = { maakFactuurSaldo };
