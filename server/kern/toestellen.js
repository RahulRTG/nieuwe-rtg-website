/* Gekoppelde toestellen: de tweede herkomst. Een horloge, een weegschaal of een
   band die zelf meet, mag dagmetingen wegschrijven onder herkomst 'apparaat'.

   DE SLEUTEL IS SMAL, en dat is de hele veiligheidsgedachte. Een toestel krijgt
   GEEN ledentoken. Het krijgt een eigen sleutel die precies een ding kan: een
   dagmeting wegschrijven voor het lid dat hem heeft aangemaakt. Hij opent geen
   agenda, geen betaalscherm en geen dossier. Een horloge dat gestolen wordt of
   een fabrikant die gehackt wordt, kost daarmee hooguit verzonnen slaapuren --
   en niet een sessie.

   DE SLEUTEL STAAT ER NIET IN. Wat bewaard wordt is een sha256-afdruk. Wie de
   database leest, kan er geen toestel mee nadoen. Het lid ziet de sleutel EEN
   keer, bij het koppelen; daarna nooit meer, en kwijt is kwijt (dan koppelt u
   opnieuw). Dat is dezelfde afspraak als bij het codewoord.

   GEEN SLOT MET EEN TELLER, en dat is een keuze met een reden. LAT.md regel 7
   zegt dat een grendel aan het doel hangt, en pinslot.js is het gedeelde slot
   voor RAADBARE geheimen: een pin van vier cijfers loopt in een uur af. Deze
   sleutel is 24 willekeurige bytes uit de CSPRNG; die valt niet af te lopen, en
   een teller eromheen zou vooral een toestel met een slecht netwerk buitensluiten.
   Wat er WEL is: intrekken, en dat werkt meteen.

   INTREKKEN WIST GEEN GESCHIEDENIS. Wat het toestel heeft gemeten, is echt
   gemeten; die metingen blijven staan met hun herkomst. Alleen schrijven stopt.
   Het lid kan losse dagen altijd zelf wissen bij de metingen. */

const MAX_TOESTELLEN = 8;

module.exports = ({ db, save, crypto, schoon, metingVanToestel }) => {
  const lijst = () => { if (!Array.isArray(db.data.toestellen)) db.data.toestellen = []; return db.data.toestellen; };
  const afdruk = t => crypto.createHash('sha256').update(String(t || ''), 'utf8').digest('hex');
  const mijne = key => lijst().filter(t => t.key === key && t.status === 'actief');

  const toon = t => ({
    id: t.id, naam: t.naam, gekoppeldOp: t.gekoppeldOp,
    laatstGezien: t.laatstGezien || null, geschreven: t.geschreven || 0
  });

  function toestellenVan(key) {
    return { ok: true, toestellen: mijne(key).map(toon) };
  }

  function toestelKoppel(key, body) {
    if (mijne(key).length >= MAX_TOESTELLEN) {
      return { status: 409, error: 'U heeft al ' + MAX_TOESTELLEN + ' toestellen gekoppeld. Trek er een in.' };
    }
    const naam = schoon(body.naam, 60);
    if (!naam) return { status: 400, error: 'Hoe heet dit toestel?' };
    const sleutel = crypto.randomBytes(24).toString('hex');
    const t = {
      id: crypto.randomBytes(4).toString('hex'), key, naam,
      afdruk: afdruk(sleutel), status: 'actief',
      gekoppeldOp: new Date().toISOString(), laatstGezien: null, geschreven: 0
    };
    lijst().push(t); save();
    /* De sleutel gaat een keer mee terug en wordt nergens bewaard. Het scherm
       zegt dat er ook bij, want een sleutel die je denkt te kunnen terugvinden
       en die er niet is, is erger dan een die je meteen opschrijft. */
    return { ok: true, toestel: toon(t), sleutel, sleutelUitleg: 'Deze sleutel ziet u nu, en daarna nooit meer. Bewaar hem in het toestel.' };
  }

  function toestelIntrek(key, body) {
    const t = mijne(key).find(x => x.id === String(body.id || ''));
    if (!t) return { status: 404, error: 'Dit toestel staat niet op uw naam.' };
    t.status = 'ingetrokken';
    t.ingetrokkenOp = new Date().toISOString();
    save();
    return { ok: true, ingetrokken: t.naam,
      uitleg: 'Dit toestel schrijft niets meer. Wat het eerder mat, blijft staan; dat is echt gemeten.' };
  }

  /* De wacht voor de toestel-deur. Geeft het toestel terug of null; de route
     mag hem NIET zelf uit de body halen, want dan is de sleutel geen sleutel. */
  function toestelVanSleutel(sleutel) {
    const s = String(sleutel || '');
    if (s.length !== 48) return null;                 // 24 bytes hex; een andere lengte is nooit een sleutel
    const a = afdruk(s);
    return lijst().find(t => t.status === 'actief' && t.afdruk === a) || null;
  }

  /* Schrijven namens een toestel. De sleutel bepaalt VOOR WIE er geschreven
     wordt; er staat met opzet geen lid in het verzoek. Anders kan een toestel
     van de een een nacht bij de ander in de boeken zetten. */
  function toestelMeting(toestel, body, nu = new Date()) {
    const r = metingVanToestel(toestel.key, body, nu);
    if (!r.ok) return r;
    toestel.laatstGezien = nu.toISOString();
    toestel.geschreven = (toestel.geschreven || 0) + 1;
    save();
    return { ok: true, onderwerp: r.onderwerp, bron: r.bron, toestel: toestel.naam };
  }

  return { toestellenVan, toestelKoppel, toestelIntrek, toestelVanSleutel, toestelMeting };
};
