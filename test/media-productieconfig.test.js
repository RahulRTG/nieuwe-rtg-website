'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { keurMedia } = require('../server/config/productie-media');
const { s3ConfigVanEnv } = require('../server/media/s3');

function keur(env) {
  const fouten = [];
  const config = keurMedia(env, fouten);
  return { fouten, config };
}

const s3 = {
  DATABASE_URL: 'postgresql://rtg@postgres/rtg',
  RTG_MEDIA_BACKEND: 's3',
  RTG_MEDIA_S3_BUCKET: 'rtg-media',
  RTG_MEDIA_S3_KEY: 'AKIA0123456789TEST',
  RTG_MEDIA_S3_SECRET: 's'.repeat(40)
};

test('multi-instance productie weigert lokale of onbekende mediaopslag', () => {
  assert.match(keur({ DATABASE_URL: s3.DATABASE_URL }).fouten.join('\n'), /vereist RTG_MEDIA_BACKEND=s3/);
  assert.match(keur({ ...s3, RTG_MEDIA_BACKEND: 's-3' }).fouten.join('\n'), /exact "disk" of "s3"/);
});

test('S3-keuring gebruikt dezelfde verplichte configuratie als de runtime', () => {
  for (const naam of ['RTG_MEDIA_S3_BUCKET', 'RTG_MEDIA_S3_KEY', 'RTG_MEDIA_S3_SECRET']) {
    const env = { ...s3 }; delete env[naam];
    assert.match(keur(env).fouten.join('\n'), /S3-mediastore is niet productieklaar/,
      naam + ' mag niet stil naar lokale disk terugvallen');
  }
  const uit = keur(s3);
  assert.deepEqual(uit.fouten, []);
  assert.equal(uit.config.bucket, 'rtg-media');
});

test('publieke productie-S3 gebruikt uitsluitend een kale HTTPS-origin', () => {
  for (const endpoint of [
    'http://objecten.example.test',
    'https://naam:geheim@objecten.example.test',
    'https://objecten.example.test/basis',
    'https://objecten.example.test/?token=x'
  ]) {
    assert.ok(keur({ ...s3, RTG_MEDIA_S3_ENDPOINT: endpoint }).fouten.length,
      endpoint + ' hoort te worden geweigerd');
  }
  assert.deepEqual(keur({ ...s3, RTG_MEDIA_S3_ENDPOINT: 'https://objecten.example.test' }).fouten, []);
});

test('lokale ontwikkel-S3 mag voor een gesloten testserver HTTP gebruiken', () => {
  const cfg = s3ConfigVanEnv({
    RTG_MEDIA_BACKEND: 's3', RTG_MEDIA_S3_BUCKET: 'testbucket',
    RTG_MEDIA_S3_KEY: 'testkey', RTG_MEDIA_S3_SECRET: 'testsecret',
    RTG_MEDIA_S3_ENDPOINT: 'http://127.0.0.1:9000', NODE_ENV: 'test'
  });
  assert.equal(cfg.endpoint, 'http://127.0.0.1:9000');
});

test('bucket, prefix en region kunnen geen pad of stuurtekens injecteren', () => {
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_BUCKET: '../media' }).fouten.length);
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_BUCKET: 'Media-Met-Hoofdletters' }).fouten.length);
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_BUCKET: '127.0.0.1' }).fouten.length);
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_BUCKET: 'rtg..media' }).fouten.length);
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_PREFIX: '../prive' }).fouten.length);
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_PREFIX: 'media//prive' }).fouten.length);
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_PREFIX: 'media/%2e%2e' }).fouten.length);
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_REGION: 'eu west 1' }).fouten.length);
  assert.ok(keur({ ...s3, RTG_MEDIA_S3_TIMEOUT_MS: 'zonder-grens' }).fouten.length);
  assert.equal(keur({ ...s3, RTG_MEDIA_S3_TIMEOUT_MS: '2500' }).config.timeoutMs, 2500);
});
