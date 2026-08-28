/* DE VERZENDWACHTRIJ: post die het huis verlaat, gaat eerst in een lade.

   WAAROM DIT ER MOET ZIJN. server/mail.js verstuurt vandaag direct: lukt het
   niet, dan valt het bericht in de outbox en is het klaar. Voor een
   bevestigingsmail is dat te billijken; voor een enterprise-mailsysteem niet.
   Een tijdelijke storing bij de ontvanger (een volle schijf, een grijze lijst,
   een server die even weg is) is de NORMALE gang van zaken bij e-mail, en de
   enige juiste reactie is: later opnieuw. Zonder wachtrij is "later opnieuw"
   een handeling van een mens die niet weet dat er iets te doen is.

   DE VIER DINGEN DIE EEN WACHTRIJ ECHT MOET KUNNEN, en ze staan hier alle vier:

   1. HERPROBEREN MET OPLOPENDE WACHTTIJD. 1, 5, 15, 60, 240 minuten. Niet
      sneller: elke poging kost de ontvanger werk, en tien pogingen per minuut
      is hoe je op een zwarte lijst komt.
   2. EEN PERMANENTE FOUT WORDT NOOIT HERHAALD. Een 5xx zegt dat het adres niet
      bestaat. Nog een keer proberen is dan geen doorzettingsvermogen maar
      spam -- server/smtp-direct.js maakt dat onderscheid al, hier wordt ernaar
      gehandeld.
   3. EEN DEAD-LETTER LADE. Wat na de laatste poging niet weg is, verdwijnt
      niet: het gaat opzij MET de laatste foutmelding, zodat een mens kan zien
      wat er is gebeurd. Een wachtrij die stilletjes leegloopt, is erger dan
      geen wachtrij.
   4. DUBBELE AFLEVERING HERKENNEN. Elk bericht heeft een sleutel; twee keer
      hetzelfde in de wachtrij zetten levert een verwijzing naar de eerste op,
      niet een tweede bezorging. Anders krijgt een klant twee bevestigingen
      omdat er ergens een knop twee keer werd ingedrukt.

   ER LOOPT GEEN WEKKER. `werk()` wordt aangeroepen door wie er langskomt (een
   route, een onderhoudstaak). Dat is dezelfde keuze als bij het uitgesteld
   verzenden in kern/rtmail-schrijf.js, en om dezelfde reden: een wekker die
   een keer niet loopt, doet niets en zegt niets. Deze manier haalt de
   achterstand vanzelf in. */
'use strict';

// de wachttijden tussen twee pogingen, in minuten
const WACHT = [1, 5, 15, 60, 240];
const MAX = 5000;

module.exports = ({ db, save, crypto, verzend }) => {
  const nu = () => new Date().toISOString();
  const kap = (s, n) => String(s == null ? '' : s).slice(0, n);

  const eigen = require('./eigencollectie')({ db, domein: 'kern/mailwachtrij', bezit: { mailQ: 'kaart' } });
  function Q() {
    const q = eigen.bak('mailQ');
    if (!Array.isArray(q.rijen)) q.rijen = [];
    if (!Array.isArray(q.dood)) q.dood = [];
    return q;
  }

  /* De sleutel waarop we een dubbele aflevering herkennen: ontvanger,
     onderwerp en de tekst. Bewust NIET de tijd -- twee keer hetzelfde bericht
     binnen een tel is precies wat we willen vangen. Wie echt twee keer
     hetzelfde wil sturen, geeft een eigen `sleutel` mee. */
  const sleutelVan = (b) => crypto.createHash('sha256')
    .update([b.naar, b.onderwerp, b.tekst].join('\x00')).digest('hex').slice(0, 24);

  function zet({ naar, onderwerp, tekst, sleutel, bron } = {}) {
    const adres = String(naar || '').trim();
    if (!adres || !/@/.test(adres)) return { error: 'Dat is geen e-mailadres.' };
    const q = Q();
    if (q.rijen.length >= MAX) return { error: 'De verzendwachtrij zit vol; er gaat iets anders mis.' };
    const s = kap(sleutel, 64) || sleutelVan({ naar: adres, onderwerp, tekst });
    const bestaand = q.rijen.find(r => r.sleutel === s) ||
      q.dood.find(r => r.sleutel === s && r.soort !== 'permanent');
    if (bestaand) return { ok: true, id: bestaand.id, dubbel: true,
      let: 'Dit bericht stond al klaar; het wordt niet twee keer bezorgd.' };
    const rij = { id: crypto.randomBytes(6).toString('hex'), sleutel: s, naar: adres,
      onderwerp: kap(onderwerp, 160), tekst: kap(tekst, 20000), bron: kap(bron, 40) || null,
      pogingen: 0, volgende: nu(), laatsteFout: null, at: nu() };
    q.rijen.push(rij);
    save();
    return { ok: true, id: rij.id, dubbel: false, wacht: q.rijen.length };
  }

  const publiek = (r) => ({ id: r.id, naar: r.naar, onderwerp: r.onderwerp, bron: r.bron,
    pogingen: r.pogingen, volgende: r.volgende, laatsteFout: r.laatsteFout,
    soort: r.soort || null, at: r.at, bezorgdAt: r.bezorgdAt || null });

  /* Een ronde. Neemt alles wat aan de beurt is, probeert het, en verwerkt de
     uitslag. `verzend` geeft { ok, soort } terug -- precies wat
     server/smtp-direct.js levert; wie een andere verzender inschakelt, houdt
     zich aan diezelfde vorm. */
  async function werk({ maxPerRonde = 20 } = {}) {
    const q = Q();
    const t = nu();
    const aanDeBeurt = q.rijen.filter(r => r.volgende <= t).slice(0, Math.max(1, Math.min(200, maxPerRonde)));
    const uit = { geprobeerd: 0, bezorgd: 0, opnieuw: 0, opgegeven: 0, permanent: 0 };
    for (const r of aanDeBeurt) {
      uit.geprobeerd++;
      r.pogingen++;
      let res;
      try { res = await verzend(r); }
      catch (e) { res = { ok: false, soort: 'tijdelijk', waarom: e && e.message }; }
      if (res && res.ok) {
        q.rijen.splice(q.rijen.indexOf(r), 1);
        r.bezorgdAt = nu(); r.soort = 'bezorgd';
        q.dood.unshift(r);            // de dode lade draagt ook de gelukte post, als spoor
        uit.bezorgd++;
        continue;
      }
      r.laatsteFout = kap((res && (res.waarom || res.code)) || 'onbekende fout', 300);
      if (res && res.soort === 'permanent') {
        q.rijen.splice(q.rijen.indexOf(r), 1);
        r.soort = 'permanent'; r.opzijAt = nu();
        q.dood.unshift(r);
        uit.permanent++;
        continue;
      }
      if (r.pogingen >= WACHT.length) {
        q.rijen.splice(q.rijen.indexOf(r), 1);
        r.soort = 'opgegeven'; r.opzijAt = nu();
        q.dood.unshift(r);
        uit.opgegeven++;
        continue;
      }
      r.volgende = new Date(Date.now() + WACHT[r.pogingen] * 60000).toISOString();
      uit.opnieuw++;
    }
    q.dood = q.dood.slice(0, MAX);
    save();
    return uit;
  }

  /* Iets uit de dode lade opnieuw in de wachtrij zetten. Voor een PERMANENTE
     fout gebeurt dat niet zomaar: het adres bestaat niet, en nog een keer
     proberen is hoe een verzend-IP zijn reputatie verliest. Wie het toch wil,
     zegt dat met zoveel woorden. */
  function opnieuw(id, { ookPermanent } = {}) {
    const q = Q();
    const i = q.dood.findIndex(r => r.id === id);
    if (i < 0) return { error: 'Die regel staat niet in de dode lade.' };
    const r = q.dood[i];
    if (r.soort === 'bezorgd') return { error: 'Dit bericht is bezorgd; opnieuw sturen zou een tweede kopie zijn.' };
    if (r.soort === 'permanent' && !ookPermanent) {
      return { error: 'Dit adres weigerde permanent (' + (r.laatsteFout || 'geen reden') + '). Opnieuw proberen heeft geen zin en schaadt de reputatie van het verzendende IP; geef ookPermanent mee als u het toch wilt.' };
    }
    q.dood.splice(i, 1);
    r.pogingen = 0; r.volgende = nu(); r.soort = null; r.opzijAt = null;
    q.rijen.push(r);
    save();
    return { ok: true, id: r.id };
  }

  const stand = () => {
    const q = Q();
    const t = nu();
    return {
      wacht: q.rijen.length,
      aanDeBeurt: q.rijen.filter(r => r.volgende <= t).length,
      wachttijden: WACHT,
      dood: { opgegeven: q.dood.filter(r => r.soort === 'opgegeven').length,
        permanent: q.dood.filter(r => r.soort === 'permanent').length,
        bezorgd: q.dood.filter(r => r.soort === 'bezorgd').length },
      rijen: q.rijen.slice(0, 50).map(publiek),
      laatste: q.dood.slice(0, 50).map(publiek)
    };
  };

  return { WACHT, zet, werk, opnieuw, stand, sleutelVan };
};
