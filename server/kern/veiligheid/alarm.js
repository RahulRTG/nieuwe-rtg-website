/* Het alarm: wat er gebeurt als er niet is ingecheckt, of als het codewoord
   valt. Een alarm is nooit meer dan dit: de mensen die JIJ hebt gekozen
   krijgen bericht, met (als jij dat zo hebt gezet) je laatst bekende plek.

   Wat dit NIET is, en dat hoort de gebruiker ook op het scherm te lezen:
   dit is geen alarmcentrale. Er belt niemand 112, er komt geen wagen, en er
   zit geen mens klaar die meekijkt. Zonder internet of met een server die
   plat ligt gaat er niets af. Dat eerlijk opschrijven is belangrijker dan het
   mooi laten klinken: wie denkt dat hij beschermd is en het niet is, is
   slechter af dan wie het weet.

   Escalatie in twee treden, met opzet:
     1. eerst een por naar JOU ("je bent over tijd, alles goed?"), met een
        genadetijd. Zonder die trede belt je moeder om half twee 's nachts
        omdat je je telefoon in je jas liet zitten, en na drie keer gelooft
        niemand het alarm nog. Vals alarm sloopt een veiligheidssysteem.
     2. daarna pas de kring.
   Het codewoord slaat trede 1 over: daar is de vertraging juist het gevaar. */
module.exports = ({ db, save, crypto, kring, plek, meldAan, mail, appUrl }) => {
  const nu = () => new Date().toISOString();

  function lijsten() {
    if (!db.data.veilig) db.data.veilig = {};
    if (!db.data.veilig.alarmen) db.data.veilig.alarmen = [];
    return db.data.veilig.alarmen;
  }

  const TEKST = {
    thuis: (c) => c + ' zou inmiddels thuis zijn en heeft niet ingecheckt.',
    vitaal: (c) => c + ' heeft de check-in gemist.',
    codewoord: (c) => c + ' heeft om hulp gevraagd.',
    knop: (c) => c + ' heeft zelf alarm geslagen.',
    proef: (c) => 'PROEF: dit is een test van ' + c + '. Er is niets aan de hand.'
  };

  /* Het alarm zelf. `stil` betekent: geen bevestiging terug naar het toestel
     van de melder. Dat is het codewoord-geval; wie meekijkt over een
     schouder mag niets zien gebeuren. */
  function alarmSlaan({ handle, codenaam, soort, notitie, stil, proef }) {
    const alarmen = lijsten();
    const ont = kring.ontvangers(handle);
    /* Ook een PROEF faalt als de kring leeg is. Dat lijkt streng, maar het is
       de kern van de zaak: een proefalarm bestaat om te bewijzen dat de keten
       werkt. "Proefalarm verstuurd" melden terwijl er niemand aan de andere
       kant staat, is precies de valse geruststelling die deze hele laag hoort
       te vermijden. */
    if (!ont.alle.length && !ont.mails.length)
      return { status: 400, error: 'Je kring is leeg; er is niemand om te waarschuwen. Zet eerst iemand in je kring.' };

    const id = crypto.randomBytes(6).toString('hex');
    const kop = proef ? 'RTG proefalarm' : 'RTG alarm';
    const zin = (TEKST[proef ? 'proef' : soort] || TEKST.knop)(codenaam || 'Een lid van je kring');
    const staart = notitie ? ' ' + String(notitie).slice(0, 200) : '';

    // Een lopend venster zodat de kring even mee kan kijken; bij een alarm
    // hoort dat, maar ook dit loopt vanzelf af.
    plek.vensterOpen(handle, 120, 'alarm');

    const gegaan = [];
    for (const doel of ont.metPlek) {
      const p = plek.plekVoorContact(handle, true);
      meldAan(doel, {
        title: kop,
        body: zin + staart,
        scope: 'veiligheid',
        soort, alarmId: id, van: handle, vanCodenaam: codenaam,
        plek: p, kaart: p ? kaartLink(p) : null, proef: !!proef
      });
      gegaan.push(doel);
    }
    for (const doel of ont.zonderPlek) {
      meldAan(doel, {
        title: kop, body: zin + staart, scope: 'veiligheid',
        soort, alarmId: id, van: handle, vanCodenaam: codenaam, plek: null, proef: !!proef
      });
      gegaan.push(doel);
    }
    for (const adres of ont.mails) {
      const p = plek.plekVoorContact(handle, true);
      try {
        mail.send(adres, kop + ' (' + (codenaam || 'RTG') + ')',
          zin + staart + '\n\n' +
          (p ? 'Laatst bekende plek (' + p.ouderdomMin + ' min geleden): ' + kaartLink(p) + '\n\n' : 'Er is geen recente plek bekend.\n\n') +
          'Dit bericht komt uit de RTG-veiligheidskring. RTG is geen alarmcentrale: bij levensgevaar belt u het alarmnummer.\n' +
          (appUrl() ? appUrl() + '/apps/thuiswacht.html\n' : ''));
      } catch (e) { /* een mislukte mail mag de rest van het alarm nooit tegenhouden */ }
    }

    alarmen.unshift({
      id, handle, soort, at: nu(), vanCodenaam: codenaam || '',
      notitie: notitie ? String(notitie).slice(0, 200) : '',
      naar: gegaan, mails: ont.mails.length, proef: !!proef, stil: !!stil,
      afgesloten: false, plek: plek.laatstePlek(handle) || null
    });
    db.data.veilig.alarmen = alarmen.slice(0, 200);
    save();

    if (!stil) meldAan(handle, {
      title: proef ? 'Proefalarm verstuurd' : 'Alarm verstuurd',
      body: gegaan.length + ' contact(en) en ' + ont.mails.length + ' e-mailadres(sen) zijn gewaarschuwd.',
      scope: 'veiligheid', soort: 'bevestiging', alarmId: id
    });
    return { status: 200, ok: true, id, naar: gegaan.length, mails: ont.mails.length };
  }

  // Een gewone kaartlink; geen eigen kaartdienst nodig om een plek te delen.
  function kaartLink(p) { return 'https://www.openstreetmap.org/?mlat=' + p.lat + '&mlon=' + p.lon + '#map=17/' + p.lat + '/' + p.lon; }

  /* Afsluiten: "het is goed". Iedereen die het alarm kreeg, hoort ook het
     einde. Een alarm dat blijft hangen is bijna net zo erg als geen alarm. */
  function alarmAfsluiten(handle, id, hoe) {
    const alarmen = lijsten();
    const a = alarmen.find(x => x.id === id && x.handle === handle);
    if (!a) return { status: 404, error: 'Dit alarm kennen we niet.' };
    if (a.afgesloten) return { status: 200, ok: true };
    a.afgesloten = true; a.afgeslotenAt = nu(); a.hoe = String(hoe || '').slice(0, 120);
    for (const doel of a.naar)
      meldAan(doel, {
        title: 'Alarm afgesloten', scope: 'veiligheid', soort: 'einde', alarmId: id,
        body: (a.vanCodenaam || 'Het lid') + ' heeft het alarm afgesloten.' + (a.hoe ? ' ' + a.hoe : '')
      });
    plek.vensterSluit(handle);
    save();
    return { status: 200, ok: true };
  }

  function alarmenVan(handle, max) {
    return lijsten().filter(a => a.handle === handle).slice(0, Math.min(50, Number(max) || 20))
      .map(a => ({ id: a.id, soort: a.soort, at: a.at, naar: a.naar.length, mails: a.mails, proef: a.proef, afgesloten: a.afgesloten, hoe: a.hoe || '' }));
  }

  // Alarmen waarin IK het contact was: het scherm van de kring-kant.
  function alarmenVoorMij(handle, max) {
    return lijsten().filter(a => a.naar.includes(handle)).slice(0, Math.min(50, Number(max) || 20))
      .map(a => {
        const magPlek = kring.ontvangers(a.handle).metPlek.includes(handle);
        return {
          id: a.id, soort: a.soort, at: a.at, afgesloten: a.afgesloten, proef: a.proef,
          codenaam: a.vanCodenaam || '', notitie: a.notitie,
          plek: a.afgesloten ? null : plek.plekVoorContact(a.handle, magPlek)
        };
      });
  }

  /* KAN ER IEMAND GEWAARSCHUWD WORDEN? Deze vraag hoort hier thuis, want hier
     staat ook het antwoord dat alarmSlaan zelf geeft. Het codewoord en de
     dodemansknop moeten hem VOORAF kunnen stellen -- op het moment dat iemand
     zijn noodsignaal instelt en er nog iets aan te doen valt. Dat is het enige
     moment waarop je het nog kunt zeggen: als het codewoord eenmaal valt, is
     het stil (met opzet) en hoort er geen melding op dat toestel te komen. */
  function kringLeeg(handle) {
    try { const o = kring.ontvangers(handle); return !o.alle.length && !o.mails.length; }
    catch (e) { return false; }   // bij twijfel niet in de weg staan
  }

  return { alarmSlaan, alarmAfsluiten, alarmenVan, alarmenVoorMij, kaartLink, kringLeeg };
};
