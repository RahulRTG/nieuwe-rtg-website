/* EEN HERHAALSLEUTEL IN HET THEATER OVERLEEFT EEN HERSTART (19 oktober 2026).

   De voltooiproef van Theater (scripts/lib/voltooi/theater.js) liet de maker
   na een crash zijn publicatie opnieuw versturen, met dezelfde sleutel die het
   scherm per opname meestuurt: er kwam een TWEEDE film in de zaal. De
   antwoordkas van de idempotentielaag woont in het geheugen en is na een crash
   leeg; alleen de kern kan de herhaling dan nog herkennen, omdat de sleutel op
   de videokaart en op de reactie zelf staat (kern/theater/video.js en
   zaal.js). Deze toets bouwt het domein twee keer op dezelfde gegevens --
   precies wat een herstart doet -- en zakt zonder die herkenning. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakTheater } = require('../server/kern/theater');

const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-theater-herhaal-'));
test.after(() => { try { fs.rmSync(MAP, { recursive: true, force: true }); } catch (e) {} });
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(400, 7)]);

const bouw = (data) => {
  const db = { data };
  const t = maakTheater({ db, save: () => {}, crypto, schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    codenaamVan: (k) => 'Codenaam ' + k, notify: () => {}, sseToOffice: () => {}, sseToCustomer: () => {},
    mediaDir: MAP, accounts: null, findSupplier: () => null });
  return { db, t };
};

test('na een herstart is dezelfde sleutel dezelfde videokaart en dezelfde reactie', () => {
  const eerst = bouw({});
  const k = eerst.t.theaterKanaalMaak('maker', { naam: 'Proefkanaal' });
  eerst.t.theaterOfficeBeslis(k.kanaal.id, 'goedgekeurd');
  const v = eerst.t.theaterVideoMaak('maker', { titel: 'Film', idem: 'theater-video-1' });
  assert.equal(eerst.t.theaterVideoUpload('maker', v.id, WEBM).status, 200);
  assert.equal(eerst.t.theaterReactie('kijker', v.id, 'Mooi', 'theater-reactie-1').status, 200);

  const na = bouw(JSON.parse(JSON.stringify(eerst.db.data)));
  const v2 = na.t.theaterVideoMaak('maker', { titel: 'Film', idem: 'theater-video-1' });
  assert.equal(v2.id, v.id, 'dezelfde kaart, geen tweede film');
  assert.equal(na.t.theaterVideoUpload('maker', v2.id, WEBM).status, 409, 'de bytes staan er al');
  na.t.theaterReactie('kijker', v.id, 'Mooi', 'theater-reactie-1');
  const rs = na.t.theaterReacties(v.id).reacties;
  assert.deepEqual(rs.map((r) => r.tekst), ['Mooi']);
  assert.ok(rs.every((r) => !('idem' in r)), 'de sleutel gaat niet naar de lezer');
  assert.equal(na.t.theaterZaal('kijker').nieuw.filter((x) => x.titel === 'Film').length, 1);
});

test('een nieuwe sleutel of geen sleutel is een echte tweede handeling', () => {
  const { t } = bouw({});
  const k = t.theaterKanaalMaak('maker', { naam: 'Tweede kanaal' });
  t.theaterOfficeBeslis(k.kanaal.id, 'goedgekeurd');
  const a = t.theaterVideoMaak('maker', { titel: 'A', idem: 'x-1' });
  const b = t.theaterVideoMaak('maker', { titel: 'A', idem: 'x-2' });
  const c = t.theaterVideoMaak('maker', { titel: 'A' });
  assert.equal(new Set([a.id, b.id, c.id]).size, 3);
});
