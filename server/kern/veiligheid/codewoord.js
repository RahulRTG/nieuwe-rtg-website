/* Het codewoord: een zin die je in een gewoon gesprek kunt laten vallen, en
   die stil je kring waarschuwt met je plek.

   Waar dit voor is: het moment dat je niet vrij kunt praten. Iemand kijkt
   mee, iemand luistert mee, je zit bij iemand in de auto. Je typt tegen
   Rahul iets doodgewoons -- "is de kat al gevoerd" -- en er gebeurt op je
   scherm NIETS. Geen pop-up, geen geluid, geen vinkje. Rahul antwoordt
   gewoon zoals altijd. Ondertussen heeft je kring bericht.

   Dat "er gebeurt niets" is geen luiheid maar de kern van de functie. Een
   bevestiging op het scherm is precies wat degene die meekijkt zou zien.

   Hoe het wordt bewaard. Niet als tekst: alleen een sleutelafdruk (HMAC met
   de serversleutel plus een eigen zout per lid). Wij kunnen jouw zin dus niet
   teruglezen, en het scherm toont hem na het instellen nooit meer.

   Eerlijk over de afweging: we gebruiken HMAC en niet scrypt, omdat deze
   controle bij ELK bericht langs moet en scrypt daar met opzet te traag voor
   is (dat zou de server plat leggen). Het gevolg: wie zowel de database als
   de serversleutel steelt, zou een korte, veel voorkomende zin kunnen raden.
   Daarom vragen we een zin van minstens drie woorden, en daarom staat er niets
   in de database waaruit blijkt WAT de zin betekent.

   Herkennen doen we in de zin zelf, niet alleen als het hele bericht: je zin
   mag midden in een normale mededeling staan. Dat kan met een afdruk door
   over de woorden te schuiven in vensters van precies zoveel woorden als de
   zin lang is. */
module.exports = ({ db, save, crypto, kluis, alarm, plek, sociaal }) => {
  const nu = () => new Date().toISOString();
  const MIN_WOORDEN = 3;
  const MAX_WOORDEN_BERICHT = 120;   // langere berichten kappen we af; geen rekenwerk verspillen

  function lijsten() {
    if (!db.data.veilig) db.data.veilig = {};
    if (!db.data.veilig.codewoord) db.data.veilig.codewoord = {};
    return db.data.veilig.codewoord;
  }

  /* Normaliseren: hoofdletters, leestekens en dubbele spaties mogen niet
     uitmaken. Wie in paniek typt, typt slordig. */
  function woorden(tekst) {
    return String(tekst == null ? '' : tekst)
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')   // accenttekens weg, zodat een accent nooit uitmaakt
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/).filter(Boolean);
  }

  function afdruk(zout, deelWoorden) {
    return crypto.createHmac('sha256', 'rtg-codewoord:' + zout)
      .update(kluis.sign(deelWoorden.join(' ')) + '|' + deelWoorden.join(' '))
      .digest('hex');
  }

  const gelijk = (a, b) => {
    const A = Buffer.from(String(a), 'utf8'), B = Buffer.from(String(b), 'utf8');
    return A.length === B.length && crypto.timingSafeEqual(A, B);
  };

  function codewoordZetten(handle, zin) {
    const w = woorden(zin);
    if (w.length < MIN_WOORDEN)
      return { status: 400, error: 'Kies een zin van minstens ' + MIN_WOORDEN + ' woorden. Een los woord valt te makkelijk per ongeluk.' };
    if (w.length > 12) return { status: 400, error: 'Houd het bij hooguit twaalf woorden; je moet hem onder spanning nog kunnen typen.' };
    const C = lijsten();
    const zout = crypto.randomBytes(16).toString('hex');
    C[handle] = {
      zout, hash: afdruk(zout, w), aantal: w.length,
      aan: true, at: nu(), laatst: null, keer: 0,
      // wat er moet gebeuren; standaard alles wat stil kan
      doe: { alarm: true, locatie: true, stil: true }
    };
    save();
    return { status: 200, ok: true, aantal: w.length };
  }

  function codewoordStand(handle) {
    const c = lijsten()[handle];
    // met opzet GEEN zin, geen hash en geen zout terug; alleen dat hij er is
    return c ? { ingesteld: true, aan: c.aan !== false, aantal: c.aantal, at: c.at, keer: c.keer || 0, doe: c.doe } : { ingesteld: false, aan: false };
  }

  function codewoordSchakel(handle, aan) {
    const C = lijsten();
    if (!C[handle]) return { status: 404, error: 'Er is nog geen codewoord ingesteld.' };
    C[handle].aan = aan !== false;
    save();
    return { status: 200, ok: true, stand: codewoordStand(handle) };
  }

  function codewoordWissen(handle) {
    const C = lijsten();
    delete C[handle];
    save();
    return { status: 200, ok: true, stand: codewoordStand(handle) };
  }

  /* Zit de zin in deze tekst? Puur herkennen, zonder gevolgen. Het venster
     schuift woord voor woord op, dus je zin mag midden in een gewoon bericht
     staan. */
  function past(c, tekst) {
    const w = woorden(tekst).slice(0, MAX_WOORDEN_BERICHT);
    if (!c || w.length < c.aantal) return false;
    for (let i = 0; i + c.aantal <= w.length; i++) {
      if (gelijk(afdruk(c.zout, w.slice(i, i + c.aantal)), c.hash)) return true;
    }
    return false;
  }

  /* Oefenen: klopt mijn zin nog? Slaat NOOIT alarm, en werkt ook als het
     codewoord tijdelijk uit staat. Dit is de enige plek die eerlijk "ja" of
     "nee" zegt, en hij hoort achter een aparte oefenknop in de app; je oefent
     als je alleen bent, niet als het erop aankomt. */
  function codewoordProef(handle, tekst) {
    try { return past(lijsten()[handle], tekst); } catch (e) { return false; }
  }

  /* De echte controle. Geeft `true` als het codewoord in de tekst zat EN het
     alarm is geslagen. De aanroeper doet daar verder NIETS zichtbaars mee:
     hij antwoordt gewoon alsof er niets gebeurd is.

     Faalt stil bij alles wat misgaat. Een fout in deze laag mag nooit een
     gesprek met Rahul stukmaken, en al helemaal niet verraden dat er iets
     bijzonders aan de hand was. */
  function codewoordCheck(handle, tekst, bron) {
    try {
      const c = lijsten()[handle];
      if (!c || c.aan === false) return false;
      if (!past(c, tekst)) return false;

      // Ontdubbelen: twee keer dezelfde zin binnen een minuut is een herhaling
      // van hetzelfde moment, geen tweede noodgeval.
      const vorig = c.laatst ? new Date(c.laatst).getTime() : 0;
      c.laatst = nu(); c.keer = (c.keer || 0) + 1;
      save();
      if (Date.now() - vorig < 60000) return true;

      if (c.doe && c.doe.locatie !== false) plek.vensterOpen(handle, 180, 'codewoord');
      alarm.alarmSlaan({
        handle,
        codenaam: sociaal.codenaamVan(handle) || handle,
        soort: 'codewoord',
        notitie: 'Stil om hulp gevraagd' + (bron ? ' (' + String(bron).slice(0, 20) + ')' : '') + '.',
        stil: true                                  // geen bevestiging naar het eigen toestel
      });
      return true;
    } catch (e) { return false; }
  }

  return { codewoordZetten, codewoordStand, codewoordSchakel, codewoordWissen, codewoordCheck, codewoordProef };
};
