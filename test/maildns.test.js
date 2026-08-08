/* De mail-DNS nameting (server/maildns.js): staat het er ook echt, en klopt het?

   WAAROM DEZE TOETS EEN TABEL GEBRUIKT EN NIET HET INTERNET. Een toets die het
   echte DNS bevraagt, zakt ooit op een storing bij iemand anders -- en een toets
   die om de verkeerde reden zakt, leert iedereen om hem te negeren. De resolver
   gaat er daarom als argument in.

   Wat hier bewezen wordt:

     de dode-spoor-melding   een MX die naar een naam zonder A-record wijst is de
                             stilste manier waarop post niet aankomt, en hij
                             hoort apart te heten -- niet als "MX ontbreekt"
     naar de juiste machine  een MX die keurig bestaat maar naar een ANDER IP
                             wijst dan het onze, is fout en zegt dat
     de lange TXT            DNS knipt een TXT boven de 255 tekens in stukken;
                             wie die niet aan elkaar plakt, mist elke DKIM-sleutel
     de PTR tegen de HELO    een omgekeerde naam die niet gelijk is aan de naam
                             waarmee wij ons voorstellen, is precies waar grote
                             ontvangers op weigeren
     wat er te DOEN is       elke misser draagt een concrete regel om te
                             publiceren; een melding zonder handeling is een
                             klacht en geen meting

   Draai: node --experimental-sqlite --test test/maildns.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { controleer } = require('../server/maildns');

/* Een resolver van papier. Alles wat niet in de tabel staat, werpt -- net als
   het echte DNS bij een naam die niet bestaat. */
function resolver(tabel) {
  const haal = (soort, naam) => {
    const v = tabel[soort + ':' + String(naam).toLowerCase()];
    if (v === undefined) { const e = new Error('niet gevonden'); e.code = 'ENOTFOUND'; throw e; }
    return v;
  };
  return {
    resolveMx: async (n) => haal('mx', n),
    resolve4: async (n) => haal('a', n),
    resolveTxt: async (n) => haal('txt', n),
    reverse: async (ip) => haal('ptr', ip)
  };
}
const vind = (r, wat) => r.regels.filter(x => x.wat === wat);
const GOED = {
  'mx:rtg.test': [{ exchange: 'mail.rtg.test', priority: 10 }],
  'a:mail.rtg.test': ['203.0.113.7'],
  'txt:rtg.test': [['v=spf1 ip4:203.0.113.7 -all']],
  'txt:rtg._domainkey.rtg.test': [['v=DKIM1; k=rsa; p=AAAA']],
  'txt:_dmarc.rtg.test': [['v=DMARC1; p=quarantine']],
  'ptr:203.0.113.7': ['mail.rtg.test']
};
const meting = (extra, opties) => controleer(Object.assign({
  dns: resolver(Object.assign({}, GOED, extra || {})),
  domein: 'rtg.test', ip: '203.0.113.7', selector: 'rtg', helo: 'mail.rtg.test'
}, opties || {}));

test('alles goed gepubliceerd levert geen enkele misser op', async () => {
  const r = await meting();
  assert.equal(r.mis, 0, JSON.stringify(r.regels.filter(x => !x.ok), null, 1));
  assert.equal(vind(r, 'MX')[0].ok, true);
  assert.equal(vind(r, 'MX->IP')[0].ok, true);
  // een geslaagde regel draagt GEEN handeling: er valt niets te doen
  for (const x of r.regels) assert.equal(x.doen, '', x.wat + ' is goed en hoort geen huiswerk te geven');
});

test('een MX naar een naam zonder A-record heet een dood spoor, en niet "geen MX"', async () => {
  /* Het onderscheid doet ertoe. Bij "geen MX" gaat iemand een MX publiceren die
     er al is; bij "dood spoor" zet hij het A-record erbij, en dat is de fout. */
  const r = await meting({ 'a:mail.rtg.test': undefined });
  const a = vind(r, 'A')[0];
  assert.equal(a.ok, false);
  assert.match(a.zegt, /dood spoor/);
  assert.match(a.doen, /mail\.rtg\.test\s+A\s+203\.0\.113\.7/);
  assert.equal(vind(r, 'MX')[0].ok, true, 'de MX zelf is niet het probleem en hoort niet mee te zakken');
});

test('een MX die bestaat maar naar een andere machine wijst, is fout', async () => {
  const r = await meting({ 'a:mail.rtg.test': ['198.51.100.9'] });
  assert.equal(vind(r, 'A')[0].ok, true, 'er IS een A-record');
  const naarOns = vind(r, 'MX->IP')[0];
  assert.equal(naarOns.ok, false);
  assert.match(naarOns.zegt, /geen enkele MX-naam komt uit op 203\.0\.113\.7/);
  assert.match(naarOns.doen, /andere machine/);
});

test('een TXT-record in stukken wordt aan elkaar geplakt', async () => {
  /* DNS knipt een TXT boven de 255 tekens op. Wie de stukken niet samenvoegt,
     ziet van een DKIM-sleutel alleen het eerste stuk -- en die begint wel met
     "v=DKIM1", dus zo'n lezer zegt "in orde" terwijl de sleutel half is. */
  const lang = 'v=DKIM1; k=rsa; p=' + 'A'.repeat(300);
  const r = await meting({ 'txt:rtg._domainkey.rtg.test': [[lang.slice(0, 255), lang.slice(255)]] });
  const d = vind(r, 'DKIM')[0];
  assert.equal(d.ok, true);
  /* Op de VOLLEDIGE waarde en niet op de weergave. De weergave kapt af op 90
     tekens, en een half opgehaalde sleutel ziet er daar precies zo uit als een
     hele -- de eerste versie van deze toets keek daarnaar en liet de mutatie die
     de stukken niet samenvoegde ongemoeid door. */
  assert.equal(d.waarde, lang, 'de stukken horen weer een geheel te zijn');
  assert.equal(d.waarde.length, lang.length);
  // en hij TOONT hem afgekapt, want een sleutel van 300 tekens in een lijst helpt niemand
  assert.match(d.zegt, /^v=DKIM1; k=rsa; p=A+\.\.\.$/);
});

test('een TXT die er wel is maar het verkeerde zegt, telt niet als aanwezig', async () => {
  const r = await meting({ 'txt:rtg.test': [['google-site-verification=abc']] });
  const spf = vind(r, 'SPF')[0];
  assert.equal(spf.ok, false);
  assert.match(spf.zegt, /wel een TXT-record, maar geen dat met "v=spf1" begint/);
  assert.match(spf.doen, /v=spf1 ip4:203\.0\.113\.7 -all/);
});

test('een omgekeerde naam die niet bij de HELO past, is precies waar men op weigert', async () => {
  const r = await meting({ 'ptr:203.0.113.7': ['ec2-203-0-113-7.hoster.example'] });
  const p = vind(r, 'PTR')[0];
  assert.equal(p.ok, false);
  assert.match(p.zegt, /heet omgekeerd ec2-203-0-113-7\.hoster\.example, en wij stellen ons voor als mail\.rtg\.test/);
  assert.match(p.doen, /of de PTR aanpassen, of MAIL_HELO gelijkzetten/);
});

test('elke misser draagt een handeling; een meting zonder handeling is een klacht', async () => {
  /* Dit is de regel die dit bestand bruikbaar maakt in plaats van vervelend.
     Alles tegelijk stuk, en dan mag er geen enkele melding zijn die alleen zegt
     DAT het mis is. */
  const r = await controleer({ dns: resolver({}), domein: 'rtg.test', ip: '203.0.113.7', helo: 'mail.rtg.test' });
  assert.ok(r.mis >= 4, 'met een leeg DNS hoort bijna alles te missen: ' + r.mis);
  assert.equal(r.goed, 0);
  for (const x of r.regels) {
    assert.equal(x.ok, false);
    assert.ok(x.doen && x.doen.length > 10, x.wat + ' meldt een probleem zonder te zeggen wat eraan te doen is');
  }
});

test('zonder IP zegt hij dat hij het niet kan nakijken, in plaats van goed te keuren', async () => {
  /* Stil overslaan zou hier de gevaarlijkste uitkomst zijn: een PTR die nooit is
     nagekeken ziet er in een lijstje net zo uit als een PTR die klopt. */
  const r = await meting({}, { ip: null });
  const p = vind(r, 'PTR')[0];
  assert.equal(p.ok, false);
  assert.match(p.zegt, /geen IP meegegeven/);
  assert.equal(vind(r, 'MX->IP').length, 0, 'en dan wordt er ook niets beweerd over waar de MX heen wijst');
});
