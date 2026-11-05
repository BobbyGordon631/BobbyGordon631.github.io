// Run with node --test tests/form-delivery.cjs. No network requests are made.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'site-config.json')));

function setup(fetch) {
  function element(value = '') {
    return { value, hidden: false, dataset: {}, handlers: {}, selectedOptions: [{ textContent: value }],
      addEventListener(name, handler) { this.handlers[name] = handler; },
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; },
      closest() { return this; }, setCustomValidity() {}, focus() {} };
  }
  const values = { name: 'Test Person', email: 'test@example.invalid', business: 'A & B',
    description: 'A request with & and + characters', service: '', pages: 'unknown',
    features: 'basic', content: 'ready', update_scope: 'small', _gotcha: '' };
  const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, element(value)]));
  const ids = Object.fromEntries(['inquiry-form', 'form-status', 'delivery-notice', 'quote-result',
    'quote-range', 'quote-basis', 'email-fallback', 'email-request', 'email-request-body',
    'update-scope-field'].map(id => [id, element()]));
  ids['quote-result'].hidden = ids['email-fallback'].hidden = true;
  const button = element();
  const form = ids['inquiry-form'];
  form.elements = fields;
  form.querySelector = () => button;
  form.querySelectorAll = () => [];
  form.reportValidity = () => true;
  const events = [];
  const timers = new Map();
  vm.runInNewContext(source, {
    window: { KKSOLVE_CONFIG: config, dispatchEvent: event => events.push(event) },
    document: { getElementById: id => ids[id], querySelectorAll: () => [] },
    FormData: class extends Map {
      constructor() { super(Object.entries(fields).filter(([, field]) => !field.disabled).map(([key, field]) => [key, field.value])); }
    },
    fetch, AbortController, Intl, encodeURIComponent,
    CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data.detail; } },
    setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id)
  });
  return { ids, fields, button, events, timers, submit: () => form.handlers.submit({ preventDefault() {} }) };
}

test('timeout restores controls and offers the complete encoded email without reporting success', async () => {
  const app = setup((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error(), { name: 'AbortError' })));
  }));
  const pending = app.submit();
  assert.equal(app.button.disabled, true);
  app.timers.get(1)();
  await pending;
  assert.equal(app.button.disabled, false);
  assert.equal(app.ids['form-status'].dataset.state, 'error');
  assert.equal(app.ids['email-fallback'].hidden, false);
  assert.match(app.ids['email-request-body'].value, /A & B/);
  assert.match(app.ids['email-request-body'].value, /\$600–\$1,200/);
  assert.doesNotMatch(app.ids['email-request-body'].value, /gotcha/);
  const url = new URL(app.ids['email-request'].href);
  assert.equal(url.searchParams.get('body'), app.ids['email-request-body'].value);
  assert.equal(app.events.length, 0);
  assert.equal(app.timers.size, 0);
  app.fields.description.value = 'An updated request';
  app.ids['inquiry-form'].handlers.input();
  assert.match(app.ids['email-request-body'].value, /An updated request/);
});

for (const [name, response] of [
  ['activation required', { ok: true, json: async () => ({ success: 'true', message: 'Please activate your form' }) }],
  ['provider rejection', { ok: false, json: async () => ({ success: false }) }],
  ['non-JSON gateway error', { ok: false, json: async () => { throw new SyntaxError('HTML response'); } }]
]) test(name + ' preserves the request and offers direct email', async () => {
  const app = setup(async () => response);
  await app.submit();
  assert.equal(app.ids['form-status'].dataset.state, 'error');
  assert.equal(app.ids['email-fallback'].hidden, false);
  assert.equal(app.button.disabled, false);
  assert.equal(app.events.length, 0);
});

test('confirmed acceptance reports success and does not offer a duplicate submission', async () => {
  const app = setup(async (url, options) => {
    assert.equal(options.body.get('estimate_range_USD'), '$600–$1,200');
    assert.equal(options.body.get('_honey'), '');
    return { ok: true, json: async () => ({ success: 'true' }) };
  });
  await app.submit();
  assert.equal(app.ids['form-status'].dataset.state, 'success');
  assert.equal(app.ids['email-fallback'].hidden, true);
  assert.equal(app.events.length, 1);
  assert.equal(app.button.disabled, false);
});
