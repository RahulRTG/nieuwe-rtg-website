/* RTG Office, de gedeelde basis: grenzen, sjablonen en de helpers die
   elke office-functie nodig heeft (opslag, rechten, namen bij sleutels
   en het schoonmaken van inhoud per soort). De soorten sleutels:
   leden op eigen account, teams als 'sup:CODE', de RTG-kantoren als
   'rtg:kantoor' en RTF-gezinsprofielen als 'rtf:CODE:handle'. */

const SOORTEN = ['tekst', 'blad', 'presentatie'];
const MAX_DOCS = 200;            // per eigenaar (lid, zaak of kantoor)
const MAX_BYTES = 500000;        // per document (ruime kantoortekst, blad of deck)
const MAX_TITEL = 120;
const MAX_VERSIES = 15;
const MAX_DIAS = 60;

/* Sjablonen: een vliegende start per soort; pure inhoud, geen logica. */
const SJABLONEN = {
  brief: { soort: 'tekst', titel: 'Zakelijke brief', inhoud: { tekst: '<p>[Uw naam of zaak]<br>[Adres]</p><p>Betreft: </p><p>Geachte ,</p><p><br></p><p>Met vriendelijke groet,</p>' } },
  notulen: { soort: 'tekst', titel: 'Notulen', inhoud: { tekst: '<p><b>Notulen</b> · [datum]</p><p>Aanwezig: </p><ul><li>Opening</li><li>Besluiten</li><li>Actiepunten (wie, wat, wanneer)</li><li>Rondvraag</li></ul>' } },
  factuurblad: { soort: 'blad', titel: 'Factuurregels', inhoud: { cellen: {
    A1: 'Omschrijving', B1: 'Aantal', C1: 'Prijs', D1: 'Regel',
    D2: '=B2*C2', D3: '=B3*C3', D4: '=B4*C4',
    C6: 'Totaal', D6: '=SOM(D2:D4)'
  }, rijen: 20, kolommen: 6 } },
  weekplan: { soort: 'blad', titel: 'Weekplanning', inhoud: { cellen: {
    A1: 'Dag', B1: 'Ochtend', C1: 'Middag', D1: 'Avond',
    A2: 'Maandag', A3: 'Dinsdag', A4: 'Woensdag', A5: 'Donderdag', A6: 'Vrijdag', A7: 'Zaterdag', A8: 'Zondag'
  }, rijen: 12, kolommen: 5 } },
  pitch: { soort: 'presentatie', titel: 'Pitch', inhoud: { dias: [
    { titel: 'De titel van uw verhaal', tekst: 'Wie u bent, in een zin.' },
    { titel: 'Het probleem', tekst: 'Wat lost u op, en voor wie?' },
    { titel: 'De oplossing', tekst: 'Hoe u het oplost; een zin per punt.' },
    { titel: 'De vraag', tekst: 'Wat heeft u nodig van de zaal?' }
  ] } }
};

function maakBasis({ db, crypto, codenaamVan }) {
  const id = () => 'doc' + crypto.randomBytes(6).toString('hex');
  const nu = () => new Date().toISOString();

  function lijsten() {
    if (!db.data.officeDocs || typeof db.data.officeDocs !== 'object') db.data.officeDocs = {};
    return db.data.officeDocs;
  }
  const docMet = did => Object.values(lijsten()).find(d => d.id === String(did || '')) || null;
  // de grootte van de inhoud (JSON), zodat een document niet ongelimiteerd groeit
  const grootteVan = inhoud => { try { return Buffer.byteLength(JSON.stringify(inhoud || null)); } catch (e) { return Infinity; } };
  // de naam bij een sleutel: leden op codenaam, teams op zaakcode, RTG als kantoor
  const naamVan = key => {
    const k = String(key || '');
    if (k.startsWith('sup:')) return 'Team ' + k.slice(4);
    if (k === 'rtg:kantoor') return 'RTG Kantoor';
    if (k.startsWith('rtf:')) return k.split(':')[2] || 'gezinslid';
    return codenaamVan(k);
  };
  // de kring: een RTF-gezin deelt binnen het eigen gezin, nooit daarbuiten
  const inKring = (d, kring) => !!(kring && d.kring === kring && d.kringDeel);
  const magSchrijven = (d, key, kring) => d.key === key || (d.bewerkers || []).includes(key)
    || (inKring(d, kring) && d.kringDeel === 'bewerken');
  const magLezen = (d, key, kring) => magSchrijven(d, key, kring) || (d.gedeeldMet || []).includes(key)
    || inKring(d, kring);

  // de inhoud netjes begrenzen per soort (geen vreemde velden, geen enorme cellen)
  function schoonInhoud(soort, inhoud) {
    if (soort === 'blad') {
      const cellen = {};
      const bron = (inhoud.cellen && typeof inhoud.cellen === 'object') ? inhoud.cellen : {};
      let n = 0;
      for (const [ref, waarde] of Object.entries(bron)) {
        if (!/^[A-Z]{1,2}[0-9]{1,3}$/.test(ref) || n++ > 4000) continue;
        cellen[ref] = String(waarde == null ? '' : waarde).slice(0, 400);
      }
      const rijen = Math.min(200, Math.max(1, parseInt(inhoud.rijen, 10) || 20));
      const kolommen = Math.min(26, Math.max(1, parseInt(inhoud.kolommen, 10) || 8));
      return { cellen, rijen, kolommen };
    }
    if (soort === 'presentatie') {
      const bron = Array.isArray(inhoud.dias) ? inhoud.dias : [];
      const dias = bron.slice(0, MAX_DIAS).map(x => ({
        titel: String((x && x.titel) || '').slice(0, MAX_TITEL),
        tekst: String((x && x.tekst) || '').slice(0, 4000)
      }));
      return { dias: dias.length ? dias : [{ titel: 'Titelblad', tekst: '' }] };
    }
    return { tekst: String(inhoud.tekst || '').slice(0, MAX_BYTES) };
  }

  return { id, nu, lijsten, docMet, grootteVan, naamVan, inKring, magSchrijven, magLezen, schoonInhoud };
}

module.exports = { SOORTEN, MAX_DOCS, MAX_BYTES, MAX_TITEL, MAX_VERSIES, MAX_DIAS, SJABLONEN, maakBasis };
