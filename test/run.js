/* Tests that drive the real tool pages. Run with: npm test */

const fs = require('fs');
const path = require('path');
const { loadTool, SRC } = require('./harness');

let pass = 0, fail = 0;
const failures = [];
const pending = [];   // tests that resolve asynchronously

function ok(cond, label, detail) {
  if (cond) { pass++; return; }
  fail++;
  failures.push(label + (detail ? '\n      ' + detail : ''));
}

function has(actual, expected, label) {
  ok(String(actual).indexOf(expected) !== -1, label,
     'expected to contain "' + expected + '"\n      got: "' + actual + '"');
}

// ---------------------------------------------------------------- structure

(function registryMatchesDisk() {
  const win = {};
  new Function('window', fs.readFileSync(path.join(SRC, 'assets/tools.js'), 'utf8'))(win);
  const { TOOLS, CATEGORIES } = win;
  const cats = new Set(CATEGORIES.map(c => c.id));

  TOOLS.forEach(t => {
    ok(fs.existsSync(path.join(SRC, 'tools', t.slug + '.html')),
       'page exists for ' + t.slug);
    ok(cats.has(t.category), 'valid category on ' + t.slug, 'got ' + t.category);
    ok(t.desc && t.desc.length < 90, 'description is short enough on ' + t.slug);
    ok(Array.isArray(t.keywords) && t.keywords.length >= 3,
       'enough search keywords on ' + t.slug);
  });

  const slugs = TOOLS.map(t => t.slug);
  ok(new Set(slugs).size === slugs.length, 'no duplicate slugs');

  fs.readdirSync(path.join(SRC, 'tools')).filter(f => f.endsWith('.html')).forEach(f => {
    ok(slugs.includes(f.replace('.html', '')), 'page ' + f + ' is in the registry');
  });

  ok(CATEGORIES.reduce((a, c) => a + c.planned, 0) === 171,
     'planned totals still add up to 171');
})();

// ---------------------------------------------------------------- calculators

(function percentage() {
  const t = loadTool('percentage-calculator');
  t.set('a-pct', 15).set('a-of', 2500);
  has(t.text('a-out'), '375', '15% of 2500 is 375');
  t.set('b-part', 45).set('b-whole', 180);
  has(t.text('b-out'), '25%', '45 out of 180 is 25%');
  t.set('c-from', 1200).set('c-to', 1560);
  has(t.text('c-out'), '30%', '1200 to 1560 is a 30% increase');
  t.set('b-whole', 0);
  has(t.text('b-out'), 'zero', 'dividing by zero is refused');
  t.close();
})();

(function bmi() {
  const t = loadTool('bmi-calculator');
  t.set('cm', 170).set('kg', 68);
  has(t.text('out'), '23.5', '68kg at 170cm is BMI 23.5');
  has(t.text('out'), 'Healthy', 'and reads as healthy');
  t.set('kg', 95);
  has(t.text('out'), 'Obese', '95kg at 170cm is obese');
  t.close();
})();

(function age() {
  const t = loadTool('age-calculator');
  t.set('dob', '2000-01-01').set('on', '2026-09-26');
  has(t.text('out'), '26 years, 8 months, 25 days', 'age on a known date');
  t.set('dob', '2000-01-31').set('on', '2000-03-01');
  has(t.text('out'), '1 month, 1 day', '31 Jan to 1 Mar clamps correctly');
  t.set('dob', '2027-01-01').set('on', '2026-01-01');
  has(t.text('out'), 'after', 'a birth date in the future is rejected');
  t.close();
})();

(function loan() {
  const t = loadTool('loan-calculator');
  t.set('amount', 2000000).set('rate', 12).set('years', 5);
  has(t.text('emi'), '44,488', '2M at 12% over 5 years is ~44,488 a month');
  t.set('rate', 0);
  has(t.text('emi'), '33,333', 'a zero-interest loan just divides');
  t.close();
})();

(function discount() {
  const t = loadTool('discount-calculator');
  t.set('a-price', 4500).set('a-pct', 20).set('a-pct2', '');
  has(t.text('a-out'), '3,600', '20% off 4500 is 3600');
  t.set('a-pct2', 10);
  has(t.text('a-out'), '3,240', 'a further 10% gives 3240');
  has(t.text('a-note'), '28', 'and it says that is 28% off, not 30%');
  t.set('b-sale', 3600).set('b-pct', 20);
  has(t.text('b-out'), '4,500', 'working backwards recovers 4500');
  t.set('c-was', 4500).set('c-now', 3150);
  has(t.text('c-out'), '30', '4500 to 3150 is 30% off');
  t.close();
})();

(function billSplitter() {
  const t = loadTool('bill-splitter');
  t.set('total', 8000).set('service', 0).set('tip', 0).set('people', 4);
  has(t.text('out'), '2,000', '8000 split four ways is 2000 each');
  t.set('service', 10);
  has(t.text('out'), '2,200', 'with 10% service it is 2200 each');
  t.close();
})();

(function dateDifference() {
  const t = loadTool('date-difference');
  t.set('from', '2026-01-01').set('to', '2026-01-31');
  has(t.text('diff-out'), '30 days', '1 Jan to 31 Jan is 30 days');
  t.set('inclusive', true);
  has(t.text('diff-out'), '31 days', 'counting both ends makes it 31');
  t.set('from', '2024-01-01').set('to', '2025-01-01').set('inclusive', false);
  has(t.text('diff-out'), '366 days', '2024 is a leap year');
  t.set('start', '2026-01-01').set('offset', 60);
  has(t.text('add-out'), '2 March 2026', '60 days after 1 Jan 2026');
  t.set('offset', -1);
  has(t.text('add-out'), '31 December 2025', 'going back crosses the year');
  t.close();
})();

(function businessDays() {
  const t = loadTool('business-days');
  t.set('from', '2026-10-05').set('to', '2026-10-09');   // Mon to Fri
  has(t.text('out'), '5 working days', 'Monday to Friday is 5 working days');
  t.set('to', '2026-10-12');                              // through to next Mon
  has(t.text('out'), '6 working days', 'plus the following Monday is 6');
  t.set('hol', '2026-10-07');
  t.click('add-hol');
  has(t.text('out'), '5 working days', 'adding a midweek holiday drops it to 5');
  t.close();
})();

(function gpa() {
  const t = loadTool('gpa-calculator');
  // defaults are 3cr A, 3cr B+, 2cr A- => (12 + 9.9 + 7.4) / 8 = 3.6625
  has(t.text('out'), '3.66', 'GPA of the three default courses');
  has(t.text('s-credits'), '8', 'total credits');
  t.close();
})();

(function grade() {
  const t = loadTool('grade-calculator');
  // defaults: 15% @82, 25% @68, 60% not sat
  has(t.text('out'), '73.25', 'weighted average of what is marked');
  has(t.text('s-left'), '60', '60% of the course is still to come');
  t.set('target', 75);
  has(t.text('need-out'), '76.17', 'needs 76.17% in the final to finish on 75%');
  t.set('target', 20);
  has(t.text('need-out'), 'Already there', 'a low target is already secured');
  t.set('target', 99);
  has(t.text('need-out'), 'Not reachable', 'an impossible target says so');
  t.close();
})();

// ---------------------------------------------------------------- text tools

(function wordCounter() {
  const t = loadTool('word-counter');
  t.set('text', 'Hello world. This is a test.');
  has(t.text('s-words'), '6', 'six words');
  has(t.text('s-sentences'), '2', 'two sentences');
  t.close();
})();

(function caseConverter() {
  const t = loadTool('case-converter');
  t.set('text', 'hello world again');
  t.click('copy'); // should not throw
  const buttons = [...t.document.querySelectorAll('#modes .btn')];
  buttons.find(b => b.dataset.mode === 'snake')
         .dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  ok(t.byId('out').value === 'hello_world_again', 'snake_case conversion',
     'got ' + t.byId('out').value);
  t.close();
})();

// ---------------------------------------------------------------- developers

(function jsonFormatter() {
  const t = loadTool('json-formatter');
  t.set('in', '{"b":2,"a":1}');
  ok(t.byId('out').value.includes('"b": 2'), 'valid JSON is tidied');
  t.click('sort');
  ok(t.byId('out').value.indexOf('"a"') < t.byId('out').value.indexOf('"b"'),
     'sorting puts keys in order');
  t.click('minify');
  ok(t.byId('out').value === '{"b":2,"a":1}', 'minify removes the spacing',
     'got ' + t.byId('out').value);
  t.set('in', '{"a": }');
  has(t.text('err-slot'), 'not valid JSON', 'broken JSON is reported');
  has(t.text('err-slot'), 'Line 1', 'and it says which line');
  has(t.text('err-slot'), 'character 7', 'and points at the missing value');

  // V8 gives no position for these, so the scanner has to find it
  t.set('in', '[1,2,,3]');
  has(t.text('err-slot'), 'character 6', 'the doubled comma is located');
  t.set('in', '{"a":1,}');
  has(t.text('err-slot'), 'Remove the comma', 'a trailing comma is named plainly');
  // the value after "b": is missing, so the offending character is the
  // closing brace on line 4 - that is what the caret should point at
  t.set('in', '{\n  "a": 1,\n  "b": \n}');
  has(t.text('err-slot'), 'Line 4', 'a multi-line error reports the right line');
  has(t.text('err-slot'), 'where a value should be', 'and explains what is wrong');
  t.set('in', '{"a": "unclosed}');
  has(t.text('err-slot'), 'never closed with a quote', 'an unterminated string is caught');
  t.set('in', '{"a":1} extra');
  has(t.text('err-slot'), 'extra text', 'trailing rubbish is caught');
  t.set('in', '{"a":1}');
  ok(t.text('err-slot') === '', 'valid JSON clears the error');
  t.close();
})();

// ---------------------------------------------------------------- sri lanka

(function paye() {
  const t = loadTool('paye-tax-calculator');
  t.set('salary', 150000);
  has(t.text('annual-tax'), '0.00', 'no tax at the relief threshold');
  t.set('salary', 250000);
  has(t.text('annual-tax'), '96,000', '250k a month is 96,000 tax a year');
  t.set('salary', 400000);
  has(t.text('annual-tax'), '600,000', '400k a month is 600,000 tax a year');
  t.close();
})();

// ---------------------------------------------------------------- converters

(function unitConverter() {
  const t = loadTool('unit-converter');
  t.set('kind', 'Length').set('from-u', 'Kilometre').set('to-u', 'Mile').set('amount', 10);
  has(t.text('out'), '6.2137', '10 km is 6.2137 miles');
  t.set('kind', 'Temperature').set('from-u', 'Celsius').set('to-u', 'Fahrenheit').set('amount', 100);
  has(t.text('out'), '212', '100 C is 212 F');
  t.set('from-u', 'Celsius').set('to-u', 'Kelvin').set('amount', 0);
  has(t.text('out'), '273.15', '0 C is 273.15 K');
  t.close();
})();

(function baseConverter() {
  const t = loadTool('base-converter');
  t.set('from-base', '10').set('value', '255');
  has(t.text('results'), '1111 1111', '255 in binary');
  has(t.text('results'), 'ff', '255 in hex');
  has(t.text('results'), '377', '255 in octal');

  t.set('from-base', '16').set('value', 'ff');
  has(t.text('results'), '255', 'hex ff back to 255');

  // parseInt would silently accept this and return 1
  t.set('from-base', '2').set('value', '12');
  has(t.text('warn'), 'not a digit in base 2', 'an invalid digit is rejected, not ignored');

  // a value too large for an ordinary JS number must stay exact - as a
  // float this would come back ...992, losing the last digit
  t.set('from-base', '10').set('value', '9007199254740993');
  has(t.text('results'), '9,007,199,254,740,993', 'a big integer keeps every digit');
  t.close();
})();

(function csvJson() {
  const t = loadTool('csv-json');
  t.set('dir', 'c2j');
  t.set('in', 'name,city\n"Perera, A.",Kandy\nNimali,Galle');
  const parsed = JSON.parse(t.byId('out').value);
  ok(parsed.length === 2, 'two rows parsed', 'got ' + parsed.length);
  ok(parsed[0].name === 'Perera, A.',
     'a comma inside quotes stays in the field', 'got ' + parsed[0].name);
  ok(parsed[1].city === 'Galle', 'second row reads correctly');

  t.set('in', 'a,b\n1,true\n2,false');
  const typed = JSON.parse(t.byId('out').value);
  ok(typed[0].a === 1 && typed[0].b === true,
     'numbers and booleans come back as real types');

  // a long id must not be turned into a lossy number
  t.set('in', 'id\n9007199254740993');
  ok(JSON.parse(t.byId('out').value)[0].id === '9007199254740993',
     'an id too big for a JS number is left as text');

  // doubled quotes mean one literal quote
  t.set('in', 'q\n"she said ""hi"""');
  ok(JSON.parse(t.byId('out').value)[0].q === 'she said "hi"',
     'doubled quote marks are unescaped');

  t.set('dir', 'j2c');
  t.set('in', '[{"a":1,"b":"x, y"},{"a":2}]');
  const csv = t.byId('out').value.split('\n');
  ok(csv[0] === 'a,b', 'header row from the keys', 'got ' + csv[0]);
  ok(csv[1] === '1,"x, y"', 'a comma in a value gets quoted', 'got ' + csv[1]);
  ok(csv[2] === '2,', 'a missing key becomes an empty cell', 'got ' + csv[2]);
  t.close();
})();

(function currencyOffline() {
  const t = loadTool('currency-converter', { onLine: false });
  has(t.text('status-text'), 'Refresh', 'with no rates and no network it says what to do');
  has(t.text('out'), '—', 'and shows no made-up number');
  t.close();
})();

pending.push(function currencyLive() {
  const rates = { USD: 1, LKR: 330, EUR: 0.88, GBP: 0.75 };
  const t = loadTool('currency-converter', {
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ rates }) })
  });
  // the fetch resolves on a microtask, so let it settle
  return new Promise((resolve) => setImmediate(() => {
    t.set('amount', 100).set('from', 'USD').set('to', 'LKR');
    has(t.text('out'), '33,000', '100 USD at 330 is 33,000 LKR');
    t.set('from', 'EUR').set('to', 'GBP');
    has(t.text('out'), '85.23', 'a cross rate goes through the dollar');
    t.close();
    resolve();
  }));
});

(function timezone() {
  const t = loadTool('timezone-converter');
  t.set('base-zone', 'Asia/Colombo').set('when', '2026-10-06T09:00');
  has(t.text('zones'), 'Colombo', 'Colombo is listed');
  // Colombo is UTC+5:30 all year; London in early October is still BST (+1)
  has(t.text('zones'), 'UTC+05:30', 'Colombo offset is right');
  has(t.text('zones'), '04:30', '09:00 in Colombo is 04:30 in London');
  t.close();
})();

(function metricUs() {
  const t = loadTool('metric-us-converter');
  t.set('topic', 'oven');
  t.set('c', 180);
  ok(t.byId('f').value === '356', '180 C is 356 F', 'got ' + t.byId('f').value);
  t.set('f', 350);
  ok(Math.abs(parseFloat(t.byId('c').value) - 176.67) < 0.01,
     '350 F is about 176.67 C', 'got ' + t.byId('c').value);
  t.close();
})();

// ---------------------------------------------------------------- sri lanka

(function poya() {
  const t = loadTool('poya-calendar');
  t.set('year', '2026');
  const list = t.text('list');
  has(list, 'Duruthu', 'the year starts with Duruthu');
  has(list, 'Unduvap', 'and ends with Unduvap');
  // the 2026 correction: 1 May is Adhi Vesak, 30 May is Vesak
  has(list, 'Adhi Vesak', '1 May 2026 is Adhi Vesak after the change');
  has(t.text('source-note'), '30 May', 'the note explains the Vesak move');
  const rows = () => t.document.querySelectorAll('.poya-row').length;
  ok(rows() === 13, '2026 has 13 Poya days', 'got ' + rows());

  t.set('year', '2027');
  ok(rows() === 12, '2027 has 12', 'got ' + rows());
  ok(t.text('list').indexOf('Adhi') === -1, '2027 has no Adhi month');

  // only years we actually have gazetted data for should be offered
  const years = [...t.document.querySelectorAll('#year option')].map(o => o.value);
  ok(years.length === 2 && years.includes('2026') && years.includes('2027'),
     'only published years are offered', 'got ' + years.join(','));
  t.close();
})();

(function singlish() {
  const t = loadTool('singlish-converter');
  const conv = (s) => { t.set('in', s); return t.byId('out-text').value; };

  ok(conv('mata') === 'මට', 'mata gives මට', 'got ' + conv('mata'));
  ok(conv('sinhala') === 'සිංහල',
     'n before h becomes the anusvara in sinhala', 'got ' + conv('sinhala'));
  ok(conv('lankaawa') === 'ලංකාව',
     'n before k becomes the anusvara in lankaawa', 'got ' + conv('lankaawa'));
  // the documented scheme: d is retroflex, dh is dental
  ok(conv('kohomadha') === 'කොහොමද',
     'dh gives the dental ද', 'got ' + conv('kohomadha'));
  ok(conv('ammaa') === 'අම්මා',
     'a doubled consonant takes hal then the next letter');
  ok(conv('2026 avurudda').startsWith('2026 '),
     'digits and spaces pass through untouched', 'got ' + conv('2026 avurudda'));
  ok(conv('') === '', 'empty input gives empty output');
  t.close();
})();

(function postalCodes() {
  const t = loadTool('postal-codes');
  t.set('q', 'Nugegoda');
  has(t.text('results'), '10250', 'Nugegoda is 10250');
  t.set('q', 'Wellawatte');
  has(t.text('results'), '00600', 'a suburb name in the notes is searchable');
  t.set('q', '10250');
  has(t.text('results'), 'Nugegoda', 'searching by code finds the town');
  // a bare 300 should be understood as 00300
  t.set('q', '300');
  has(t.text('results'), 'Colombo 03', 'a code typed without leading zeros still works');
  has(t.text('count'), 'leading zeros', 'and it explains why');
  t.set('q', 'Jaffna');
  has(t.text('results'), 'Colombo District only', 'a town outside the data says so plainly');
  t.close();
})();

(function exchangeRates() {
  const rates = { USD: 1, LKR: 330, GBP: 0.75, JPY: 150 };
  const t = loadTool('exchange-rates', {
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ rates }) })
  });
  pending.push(() => new Promise((resolve) => setImmediate(() => {
    has(t.text('rates'), '330.00', 'the dollar is 330 rupees');
    has(t.text('rates'), '440.00', 'the pound works out at 440');
    // yen is shown per 100 because one yen is a couple of rupees
    has(t.text('rates'), 'per 100 JPY', 'the yen is quoted per hundred');
    t.set('amount', 50).set('cur', 'USD');
    has(t.text('out'), '16,500', '50 dollars is 16,500 rupees');
    t.close();
    resolve();
  })));
})();

// ---------------------------------------------------------------- text, part 2

(function findReplace() {
  const t = loadTool('find-replace');
  t.set('in', 'cat cats concatenate Cat');
  t.set('find', 'cat').set('repl', 'dog');
  has(t.text('count'), '4 matches', 'case-insensitive by default');
  ok(t.byId('out').value === 'dog dogs condogenate dog',
     'every match replaced', 'got ' + t.byId('out').value);

  t.click('opts');  // no-op click, should not throw
  const btn = (name) => [...t.document.querySelectorAll('#opts .btn')]
    .find(b => b.dataset.opt === name);

  btn('caseSensitive').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  has(t.text('count'), '3 matches', 'match case drops the capitalised one');

  btn('wholeWord').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  has(t.text('count'), '1 match', 'whole words only leaves one');

  // a $ in the replacement must be literal unless pattern mode is on
  btn('wholeWord').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  btn('caseSensitive').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  t.set('in', 'price').set('find', 'price').set('repl', '$1000');
  ok(t.byId('out').value === '$1000',
     'a dollar sign in the replacement stays literal', 'got ' + t.byId('out').value);

  // a broken pattern must be reported, not thrown
  btn('regex').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  t.set('find', '[unclosed');
  ok(!t.byId('err-panel').hidden, 'a bad pattern shows an error');
  has(t.text('err'), 'not valid', 'and says so in plain words');
  t.close();
})();

// ---------------------------------------------------------------- text, part 3

(function removeDuplicates() {
  const t = loadTool('remove-duplicates');
  t.set('in', 'apple\nbanana\napple\ncherry\nbanana\napple');
  ok(t.byId('out').value === 'apple\nbanana\ncherry',
     'each line kept once in original order', 'got ' + JSON.stringify(t.byId('out').value));
  has(t.text('s-removed'), '3', 'three lines removed');

  t.set('mode', 'onlyonce');
  ok(t.byId('out').value === 'cherry', 'only lines appearing exactly once');

  t.set('mode', 'onlydupes');
  ok(t.byId('out').value === 'apple\nbanana', 'only lines that repeat');

  // case folding is off by default, so these stay distinct
  t.set('mode', 'unique').set('in', 'Apple\napple');
  ok(t.byId('out').value === 'Apple\napple', 'capitals matter by default');
  t.close();
})();

(function sortLines() {
  const t = loadTool('sort-lines');
  // the whole point of natural sort: item2 before item10
  t.set('in', 'item10\nitem2\nitem1');
  t.set('mode', 'alpha');
  ok(t.byId('out').value === 'item1\nitem2\nitem10',
     'numbers inside names sort naturally', 'got ' + JSON.stringify(t.byId('out').value));

  t.set('mode', 'plain');
  ok(t.byId('out').value === 'item1\nitem10\nitem2',
     'strict character order puts item10 second');

  t.set('mode', 'numeric').set('in', '5 apples\n100 pears\n20 figs\nno number');
  ok(t.byId('out').value === '5 apples\n20 figs\n100 pears\nno number',
     'numeric sort, lines without a number last',
     'got ' + JSON.stringify(t.byId('out').value));

  t.set('mode', 'length').set('in', 'ccc\na\nbb');
  ok(t.byId('out').value === 'a\nbb\nccc', 'shortest first');

  t.set('mode', 'reverse').set('in', 'one\ntwo\nthree');
  ok(t.byId('out').value === 'three\ntwo\none', 'reverse flips the order');
  t.close();
})();

(function removeSpaces() {
  const t = loadTool('remove-spaces');
  t.set('in', 'too   many    spaces');
  ok(t.byId('out').value === 'too many spaces', 'runs of spaces collapse');

  t.set('in', 'trailing   \nlines  ');
  ok(t.byId('out').value === 'trailing\nlines', 'trailing spaces go');

  // a non-breaking space should become a real space, not disappear
  t.set('in', 'one two');
  ok(t.byId('out').value === 'one two',
     'a non-breaking space becomes an ordinary one, not nothing',
     'got ' + JSON.stringify(t.byId('out').value));
  has(t.text('found'), 'invisible character', 'and it says it found one');

  // zero-width characters should vanish entirely
  t.set('in', 'we​ird');
  ok(t.byId('out').value === 'weird', 'a zero-width space is removed outright');
  t.close();
})();

(function textCompare() {
  const t = loadTool('text-compare');
  t.set('a', 'one\ntwo\nthree').set('b', 'one\ntwo\nthree');
  has(t.text('verdict'), 'identical', 'matching text is reported as identical');

  t.set('b', 'one\ntwo changed\nthree');
  has(t.text('s-add'), '1', 'one line added');
  has(t.text('s-del'), '1', 'one line removed');
  has(t.text('s-same'), '2', 'two unchanged');

  t.set('a', 'a\nb\nc').set('b', 'a\nc');
  has(t.text('s-del'), '1', 'a deleted middle line is spotted');
  has(t.text('s-add'), '0', 'and nothing is counted as added');
  t.close();
})();

(function markdown() {
  const t = loadTool('markdown-to-html');
  const html = (md) => { t.set('in', md); return t.byId('out').value; };

  has(html('# Title'), '<h1>Title</h1>', 'a heading');
  has(html('**bold**'), '<strong>bold</strong>', 'bold');
  has(html('*italic*'), '<em>italic</em>', 'italic');
  has(html('- one\n- two'), '<li>one</li>', 'a bullet list');
  has(html('1. one\n2. two'), '<ol>', 'a numbered list');
  has(html('> quoted'), '<blockquote>', 'a block quote');
  has(html('| a | b |\n| --- | --- |\n| 1 | 2 |'), '<table>', 'a table');
  has(html('```\ncode\n```'), '<pre><code>code</code></pre>', 'a fenced code block');
  has(html('[text](https://example.com)'), 'href="https://example.com"', 'a link');

  // bold inside backticks must stay literal
  has(html('`**not bold**`'), '<code>**not bold**</code>',
      'markup inside a code span is left alone');

  // pasted HTML must be shown, not executed
  has(html('<script>alert(1)</script>'), '&lt;script&gt;',
      'raw HTML is escaped rather than run');
  // and a javascript: link must not become a live link
  ok(html('[click](javascript:alert(1))').indexOf('href="javascript:') === -1,
     'a javascript URL is not turned into a link',
     'got ' + html('[click](javascript:alert(1))'));
  t.close();
})();

// ---------------------------------------------------------------- day 9

(function nicDecoder() {
  const t = loadTool('nic-decoder');

  // the one published worked example I could find
  t.set('nic', '790029871V');
  has(t.text('out'), '2 January 1979', 'the documented example decodes correctly');
  has(t.text('s-gender'), 'Male', 'under 500 is male');

  // new 12-digit format, leap year
  t.set('nic', '199234502023');
  has(t.text('out'), '10 December 1992', 'a new-format card decodes');

  // 500 added means female, and the day is the remainder
  t.set('nic', '855400123V');
  has(t.text('s-gender'), 'Female', 'over 500 is female');
  has(t.text('out'), '1985', 'and the year still reads correctly');

  // garbage in must not produce a confident date
  t.set('nic', 'hello');
  has(t.text('out'), 'Not an NIC', 'nonsense is rejected');
  t.set('nic', '123456789');
  has(t.text('out'), 'Missing the letter', 'nine digits with no V or X is flagged');
  t.set('nic', '999999999V');
  has(t.text('out'), 'cannot be right', 'an impossible day number is refused');

  // the leap-year caveat should surface, not be hidden
  t.set('nic', '199930012345');   // 1999 is not a leap year, day 300
  has(t.text('warn'), 'not a leap year', 'the non-leap-year ambiguity is disclosed');
  t.close();
})();

(function notepad() {
  const t = loadTool('notepad');
  t.set('pad', 'hello there');
  has(t.text('counts'), '2 words', 'word count updates');
  has(t.text('counts'), '11 characters', 'character count updates');
  t.close();
})();

(function fancyText() {
  const t = loadTool('fancy-text');
  t.set('in', 'Hi');
  const shown = t.text('styles');
  // mathematical bold capital H and small i
  has(shown, '\u{1D407}\u{1D422}', 'bold style produced');
  // script capital H is a legacy codepoint, not in the contiguous block
  has(shown, 'ℋ', 'script H uses the legacy codepoint, not a hole in the block');
  t.set('in', '');
  has(t.text('styles'), 'Type something', 'empty input is handled');
  t.close();
})();

(function emojiSearch() {
  const t = loadTool('emoji-search');
  t.set('q', 'happy');
  ok(t.document.querySelectorAll('#results .ebtn').length > 0,
     'searching for happy finds emoji');
  t.set('q', 'rupee-not-an-emoji');
  has(t.text('results'), 'Nothing matches', 'a miss says so');
  t.set('q', 'poya');
  has(t.text('results'), '🌕', 'searching poya finds the full moon');
  t.close();
})();

(function canvasToolsLoad() {
  // Canvas output cannot be verified here - the harness stubs the context.
  // These only prove the pages run and their controls are wired up.
  const b = loadTool('blackboard');
  ok(b.byId('board') !== null, 'blackboard canvas exists');
  ok(b.document.querySelectorAll('#swatches .sw').length === 6,
     'six chalk colours offered');
  b.close();

  const h = loadTool('handwriting');
  ok(h.byId('paper') !== null, 'handwriting page renders a canvas');
  ok(h.document.querySelectorAll('#font option').length >= 1,
     'at least one handwriting font is offered');
  h.set('in', 'test').set('fsize', 30);
  ok(h.byId('paper').__ctx.calls.some(c => c[0] === 'fillText'),
     'text is actually written to the canvas');
  h.close();

  const q = loadTool('qr-code-generator');
  q.set('text', 'https://example.com');
  ok(q.document.querySelector('#qr-box canvas') !== null,
     'a QR canvas is produced');
  q.set('kind', 'wifi');
  q.set('ssid', 'My Net').set('wifi-pass', 'secret;1');
  ok(q.document.querySelector('#qr-box canvas') !== null,
     'a wifi QR is produced with an awkward password');
  q.set('kind', 'text').set('text', '');
  has(q.text('qr-box'), 'Enter something', 'empty input shows a prompt, not a broken code');
  q.close();
})();

// ---------------------------------------------------------------- money

(function compoundInterest() {
  const t = loadTool('compound-interest');
  // 100,000 at 10% compounded once a year for 10 years = 100000 * 1.1^10
  t.set('principal', 100000).set('rate', 10).set('years', 10)
   .set('monthly', 0).set('freq', '1');
  has(t.text('out'), '259,374', 'yearly compounding matches 1.1^10');

  // the same money compounded monthly ends up higher
  t.set('freq', '12');
  has(t.text('out'), '270,704', 'monthly compounding beats yearly');

  // zero interest must just add up the deposits
  t.set('rate', 0).set('monthly', 1000).set('years', 1).set('principal', 0);
  has(t.text('out'), '12,000', 'no interest is simply the deposits');

  // a quarterly account fed monthly - the case a closed-form formula gets wrong
  t.set('principal', 100000).set('rate', 12).set('years', 1)
   .set('monthly', 0).set('freq', '4');
  has(t.text('out'), '112,550', 'quarterly compounding over a year');
  t.close();
})();

(function mortgage() {
  const t = loadTool('mortgage-calculator');
  t.set('price', 10000000).set('depositPct', 20).set('rate', 12).set('years', 20);
  // typing a percentage must fill in the amount
  ok(t.byId('deposit').value === '2000000',
     'a deposit percentage fills in the amount', 'got ' + t.byId('deposit').value);
  // 8,000,000 at 12% over 20 years is about 88,086 a month
  has(t.text('out'), '88,0', 'the monthly payment is right');
  has(t.text('s-loan'), '8,000,000', 'the loan is price minus deposit');

  // and typing an amount must fill in the percentage
  t.set('deposit', 2500000);
  ok(t.byId('depositPct').value === '25',
     'a deposit amount fills in the percentage', 'got ' + t.byId('depositPct').value);

  // a deposit covering the whole price means no loan
  t.set('deposit', 10000000);
  has(t.text('out'), 'No loan needed', 'a full-price deposit needs no loan');
  t.close();
})();

(function savingsGoal() {
  const t = loadTool('savings-goal');
  t.set('mode', 'time').set('target', 120000).set('current', 0)
   .set('monthly', 10000).set('rate', 0);
  has(t.text('out'), '1 year', '120,000 at 10,000 a month with no interest is a year');

  // already past the target
  t.set('current', 200000);
  has(t.text('out'), 'Already there', 'an exceeded target says so');

  // saving nothing, with nothing saved, never gets there
  t.set('current', 0).set('monthly', 0).set('rate', 0);
  has(t.text('out'), 'Never', 'saving nothing never reaches the target');

  // the other direction: a deadline gives a monthly amount
  t.set('mode', 'amount').set('target', 120000).set('current', 0)
   .set('months', 12).set('rate', 0);
  has(t.text('out'), '10,000', 'the required monthly amount is worked out');
  t.close();
})();

(function salaryConverter() {
  const t = loadTool('salary-converter');
  t.set('amount', 150000).set('per', 'month')
   .set('hours', 8).set('days', 5).set('weeks', 52);
  const rows = t.text('results');
  has(rows, '1,800,000', 'a monthly salary gives the yearly figure');
  // 1,800,000 / (8 * 5 * 52) = 865.38
  has(rows, '865.38', 'and the hourly rate from real hours worked');

  // fewer weeks worked means each hour is worth more for the same year
  t.set('per', 'year').set('amount', 1800000).set('weeks', 48);
  has(t.text('results'), '937.50', 'unpaid leave raises the effective hourly rate');
  t.close();
})();

(function inflation() {
  const t = loadTool('inflation-calculator');
  t.set('amount', 100000).set('rate', 6).set('years', 10);
  // 100000 / 1.06^10 = 55,839
  has(t.text('s-worth'), '55,839', 'buying power falls as expected');
  // 100000 * 1.06^10 = 179,085
  has(t.text('s-need'), '179,085', 'and the equivalent amount rises');
  has(t.text('s-lost'), '44.2%', 'the percentage lost is shown');

  t.set('years', 0);
  has(t.text('s-worth'), '100,000', 'over zero years nothing changes');
  t.close();
})();

// ---------------------------------------------------------------- money, part 2

(function sharedTaxTable() {
  // The PAYE tool and the payslip tool must agree, because they now read
  // the same file. This checks the shared figures are actually shared.
  const win = {};
  new Function('window', fs.readFileSync(path.join(SRC, 'assets/lk-tax.js'), 'utf8'))(win);
  const T = win.LK_TAX;
  ok(T.relief === 1800000, 'relief is 1,800,000');
  ok(T.bands.length === 5, 'five bands above the relief');
  ok(Math.abs(T.annualTax(3000000).total - 96000) < 0.01,
     'shared table gives 96,000 on a 3,000,000 income',
     'got ' + T.annualTax(3000000).total);
  ok(Math.abs(T.monthlyTax(250000) - 8000) < 0.01,
     'and 8,000 a month on a 250,000 salary');

  const payeSrc = fs.readFileSync(path.join(SRC, 'tools/paye-tax-calculator.html'), 'utf8');
  ok(payeSrc.indexOf('lk-tax.js') !== -1, 'the PAYE tool loads the shared table');
  ok(payeSrc.indexOf('var RELIEF = 1800000') === -1,
     'and no longer keeps its own copy of the relief figure');
})();

(function debtPayoff() {
  const t = loadTool('debt-payoff');
  t.set('extra', 10000);
  const shown = t.text('compare');
  has(shown, 'Avalanche', 'both strategies are compared');
  has(shown, 'Snowball', 'including snowball');
  // avalanche must never cost more than snowball
  has(shown, 'Costs less', 'one is marked as cheaper');
  t.close();
})();

(function creditCard() {
  const t = loadTool('credit-card-payoff');
  t.set('balance', 200000).set('rate', 28).set('minPct', 5).set('minFloor', 1000);
  has(t.text('out'), 'year', 'minimum payments take years');

  // the important case: a minimum that cannot cover the interest
  t.set('minPct', 1).set('minFloor', 0);
  has(t.text('out'), 'never clears', 'a minimum below the interest never clears');
  has(t.text('alarm-slot'), 'grows every month', 'and it explains why');

  // zero interest should clear in balance / payment months
  t.set('rate', 0).set('minPct', 0).set('minFloor', 10000);
  has(t.text('out'), '1 year 8 months', '200,000 at 10,000 a month is 20 months');
  t.close();
})();

(function carLoan() {
  const t = loadTool('car-loan');
  t.set('price', 5000000).set('depositPct', 20).set('rate', 15).set('years', 5).set('fees', 0);
  ok(t.byId('deposit').value === '1000000', 'deposit percentage fills the amount');
  has(t.text('s-loan'), '4,000,000', 'the financed amount');
  // 4,000,000 at 15% over 5 years is about 95,161 a month
  has(t.text('out'), '95,1', 'the monthly instalment');
  // fees added to the loan must increase it
  t.set('fees', 100000);
  has(t.text('s-loan'), '4,100,000', 'fees are added to the amount financed');
  t.close();
})();

(function fuelCost() {
  const t = loadTool('fuel-cost');
  t.set('distance', 120).set('economy', 12).set('unit', 'kmpl')
   .set('price', 310).set('people', 1);
  // 120 / 12 = 10 litres at 310 = 3100
  has(t.text('out'), '3,100', '120km at 12km/l and Rs.310 is Rs.3,100');
  has(t.text('s-litres'), '10 L', 'ten litres used');

  // the other way of quoting economy is the inverse, not the same number
  t.set('unit', 'l100').set('economy', 12);
  // 120 * 12 / 100 = 14.4 litres
  has(t.text('s-litres'), '14.4 L', 'l/100km is handled as the inverse, not the same');

  t.set('unit', 'kmpl').set('economy', 12).set('people', 4);
  has(t.text('s-each'), '775', 'splitting four ways');

  t.set('people', 1).set('return', true);
  has(t.text('out'), '6,200', 'a return trip doubles the cost');
  t.close();
})();

(function payslip() {
  const t = loadTool('paycheck');
  t.set('basic', 120000).set('ot-hours', 0).set('epf-on', true);
  const slip = t.text('slip');
  // 120,000 + 15,000 + 10,000 default allowances = 145,000 gross
  has(slip, '145,000.00', 'gross is basic plus allowances');
  // EPF 8% of 145,000 = 11,600
  has(slip, '11,600.00', 'EPF is 8% of earnings');
  // employer 12% = 17,400
  has(slip, '17,400.00', 'employer EPF is 12%');

  // overtime must be added to gross but excluded from the EPF base
  t.set('ot-hours', 10).set('ot-rate', '1.5');
  // hourly = 120000/240 = 500, OT = 500 * 1.5 * 10 = 7,500
  has(t.text('slip'), '7,500.00', 'overtime is priced off the basic salary');
  has(t.text('slip'), '11,600.00', 'and EPF still ignores overtime');
  t.close();
})();

// ---------------------------------------------------------------- report

(async function report() {
  for (const t of pending) await t();
  console.log('');
  failures.forEach(f => console.log('FAIL  ' + f));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
