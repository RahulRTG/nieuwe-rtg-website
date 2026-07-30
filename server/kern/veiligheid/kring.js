/* De veiligheidskring: wie er gewaarschuwd wordt als het misgaat.

   Privacy by design, net als de rest van RTG: een contact is een CODENAAM,
   geen naam en geen telefoonnummer. De echte naam staat in de kluis en komt
   hier niet voorbij. Een kringlid moet bovendien al een actieve connectie
   zijn: je kunt niemand ongevraagd tot je noodcontact bombarderen, en
   andersom kan niemand jou als contact opvoeren zonder dat jullie verbonden
   zijn.

   Per contact leg je vast WAT hij bij een alarm mag zien. De locatie is
   standaard AAN (daar is het voor), maar uitzetten kan: dan krijgt dat
   contact wel het alarm, niet de plek. Dat is geen detail; een kring bestaat
   soms uit een partner en een buurvrouw, en die hoeven niet hetzelfde te
   weten.

   Buiten RTG kan ook: een e-mailadres. Dat gaat door de gewone maillaag en
   staat versleuteld op schijf zodra er een sleutel is (server/mail.js). */
module.exports = ({ db, save, schoon, sociaal }) => {
  const nu = () => new Date().toISOString();
  const MAX_CONTACTEN = 8;
  const MAX_MAIL = 4;

  function lijsten() {
    if (!db.data.veilig) db.data.veilig = {};
    if (!db.data.veilig.kring) db.data.veilig.kring = {};
    return db.data.veilig.kring;
  }

  const leeg = () => ({ contacten: [], mails: [], at: null });

  function kringVan(handle) {
    const k = lijsten();
    return k[handle] || leeg();
  }

  /* Wat de app toont: de codenamen met hun rechten. Nooit meer dan dit; de
     kring is geen adresboek. */
  function kringToon(handle) {
    const k = kringVan(handle);
    return {
      contacten: k.contacten.map(c => ({
        handle: c.handle,
        codenaam: sociaal.codenaamVan(c.handle) || c.codenaam || c.handle,
        locatie: c.locatie !== false,
        at: c.at
      })),
      mails: k.mails.slice(),
      compleet: k.contacten.length > 0 || k.mails.length > 0
    };
  }

  function kringToevoegen(handle, doelHandle, opties) {
    const k = lijsten();
    const doel = String(doelHandle || '').trim();
    if (!doel) return { status: 400, error: 'Wie wil je toevoegen?' };
    if (doel === handle) return { status: 400, error: 'Jezelf toevoegen heeft geen zin.' };
    // De harde grens: alleen mensen met wie je echt verbonden bent. Zo kan
    // niemand via deze weg meekijken met iemand die dat niet wil.
    if (!sociaal.zijnVrienden(handle, doel))
      return { status: 403, error: 'Je bent nog niet verbonden met deze codenaam. Verbind eerst in de Salon; dan kun je elkaar ook in de kring zetten.' };
    const mijn = k[handle] = k[handle] || leeg();
    if (mijn.contacten.some(c => c.handle === doel))
      return { status: 409, error: 'Deze codenaam staat al in je kring.' };
    if (mijn.contacten.length >= MAX_CONTACTEN)
      return { status: 400, error: 'Je kring is vol (' + MAX_CONTACTEN + '). Een kleine kring werkt beter: iedereen weet dan dat hij het is die moet gaan kijken.' };
    mijn.contacten.push({
      handle: doel,
      codenaam: sociaal.codenaamVan(doel) || doel,
      locatie: (opties || {}).locatie !== false,
      at: nu()
    });
    mijn.at = nu();
    save();
    return { status: 200, ok: true, kring: kringToon(handle) };
  }

  function kringAanpassen(handle, doelHandle, opties) {
    const k = lijsten();
    const mijn = k[handle];
    const c = mijn && mijn.contacten.find(x => x.handle === doelHandle);
    if (!c) return { status: 404, error: 'Dit contact staat niet in je kring.' };
    if (opties && 'locatie' in opties) c.locatie = opties.locatie !== false;
    mijn.at = nu();
    save();
    return { status: 200, ok: true, kring: kringToon(handle) };
  }

  function kringVerwijderen(handle, doelHandle) {
    const k = lijsten();
    const mijn = k[handle];
    if (!mijn) return { status: 200, ok: true, kring: kringToon(handle) };
    mijn.contacten = mijn.contacten.filter(c => c.handle !== doelHandle);
    mijn.at = nu();
    save();
    return { status: 200, ok: true, kring: kringToon(handle) };
  }

  function mailToevoegen(handle, adres) {
    const k = lijsten();
    const a = schoon(adres, 120).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) return { status: 400, error: 'Dat lijkt geen geldig e-mailadres.' };
    const mijn = k[handle] = k[handle] || leeg();
    if (mijn.mails.includes(a)) return { status: 409, error: 'Dit adres staat er al bij.' };
    if (mijn.mails.length >= MAX_MAIL) return { status: 400, error: 'Maximaal ' + MAX_MAIL + ' e-mailadressen.' };
    mijn.mails.push(a);
    mijn.at = nu();
    save();
    return { status: 200, ok: true, kring: kringToon(handle) };
  }

  function mailVerwijderen(handle, adres) {
    const k = lijsten();
    const mijn = k[handle];
    if (!mijn) return { status: 200, ok: true, kring: kringToon(handle) };
    mijn.mails = mijn.mails.filter(m => m !== String(adres || '').toLowerCase());
    mijn.at = nu();
    save();
    return { status: 200, ok: true, kring: kringToon(handle) };
  }

  /* De ontvangers voor een alarm, opgesplitst naar wat ze mogen zien. Wie
     zijn connectie later verbrak, valt er vanzelf uit: we controleren het
     opnieuw op het moment dat het alarm afgaat, niet alleen bij toevoegen. */
  function ontvangers(handle) {
    const k = kringVan(handle);
    const levend = k.contacten.filter(c => sociaal.zijnVrienden(handle, c.handle));
    return {
      metPlek: levend.filter(c => c.locatie !== false).map(c => c.handle),
      zonderPlek: levend.filter(c => c.locatie === false).map(c => c.handle),
      alle: levend.map(c => c.handle),
      mails: k.mails.slice()
    };
  }

  return { kringVan, kringToon, kringToevoegen, kringAanpassen, kringVerwijderen, mailToevoegen, mailVerwijderen, ontvangers };
};
