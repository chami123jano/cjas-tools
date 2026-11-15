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

// ---------------------------------------------------------------- money, part 3

(function netWorth() {
  const t = loadTool('net-worth');
  // defaults: assets 5,500,000 and debts 1,920,000
  has(t.text('out'), '3,580,000', 'net worth is assets minus liabilities');
  has(t.text('s-assets'), '5,500,000', 'total assets');
  has(t.text('s-debts'), '1,920,000', 'total liabilities');
  t.close();
})();

(function budgetPlanner() {
  const t = loadTool('budget-planner');
  t.set('income', 150000);
  // defaults add up to 136,000 spent, leaving 14,000
  has(t.text('out'), '14,000 left over', 'what is left after everything');
  has(t.text('s-spent'), '136,000', 'total spending');

  t.set('income', 100000);
  has(t.text('out'), 'short', 'spending more than you earn is flagged');
  t.close();
})();

(function emergencyFund() {
  const t = loadTool('emergency-fund');
  t.set('expenses', 90000).set('saved', 150000).set('monthly', 20000).set('months', '6');
  // 150,000 / 90,000 = 1.7 months
  has(t.text('out'), '1.7 months', 'cover is savings over monthly essentials');
  has(t.text('s-target'), '540,000', 'six months of cover');
  // gap 390,000 at 20,000 a month = 20 months
  has(t.text('s-time'), '1y 8m', 'time to close the gap');

  t.set('saved', 600000);
  has(t.text('out'), 'past your 6-month target', 'reaching the target is recognised');

  t.set('saved', 0).set('monthly', 0);
  has(t.text('s-time'), 'Never', 'saving nothing never gets there');
  t.close();
})();

(function rentVsBuy() {
  const t = loadTool('rent-vs-buy');
  t.set('years', 10);
  const shown = t.text('compare');
  has(shown, 'Renting', 'both sides are costed');
  has(shown, 'Buying', 'including buying');
  has(t.text('verdict'), 'comes out ahead', 'a verdict is given');
  // the useful part is the break-even year, not just the total
  has(t.text('verdict'), 'year', 'and it mentions how long you must stay');
  t.close();
})();

(function bookkeeping() {
  const t = loadTool('bookkeeping');
  // starts empty
  has(t.text('ledger'), 'No entries yet', 'an empty book says so');

  t.set('desc', 'Sale').set('kind', 'in').set('amount', 5000);
  t.click('add');
  has(t.text('s-in'), '5,000.00', 'income recorded');

  t.set('desc', 'Stock').set('kind', 'out').set('amount', 2000);
  t.click('add');
  has(t.text('s-out'), '2,000.00', 'expense recorded');
  has(t.text('s-balance'), '3,000.00', 'balance is in minus out');
  has(t.text('s-count'), '2', 'two entries');

  // an amount of zero or nothing must be refused, not silently added
  t.set('desc', 'Bad').set('amount', 0);
  t.click('add');
  has(t.text('form-note'), 'above zero', 'a zero amount is refused');
  has(t.text('s-count'), '2', 'and nothing was added');
  t.close();
})();

// ---------------------------------------------------------------- security

(function sharedCrypto() {
  // A real encrypt/decrypt round trip using Node's WebCrypto, which is the
  // same implementation the browser uses.
  const { webcrypto } = require('node:crypto');
  const { TextEncoder, TextDecoder } = require('node:util');
  const sandbox = {
    crypto: webcrypto, TextEncoder, TextDecoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary')
  };
  const code = fs.readFileSync(path.join(SRC, 'assets/crypto.js'), 'utf8');
  const C = new Function('crypto', 'TextEncoder', 'TextDecoder', 'btoa', 'atob',
    code + '; return CJA_CRYPTO;')(
    sandbox.crypto, sandbox.TextEncoder, sandbox.TextDecoder, sandbox.btoa, sandbox.atob);

  ok(C.available(), 'crypto reports itself available');
  ok(C.iterations >= 210000, 'PBKDF2 iterations meet current guidance',
     'got ' + C.iterations);

  pending.push(async () => {
    const blob = await C.encrypt('ayubowan, this is secret', 'correct horse battery');
    ok(typeof blob === 'string' && blob.length > 20, 'encrypting produces a blob');
    ok(blob.indexOf('secret') === -1, 'the plaintext is not visible in the output');

    const back = await C.decrypt(blob, 'correct horse battery');
    ok(back === 'ayubowan, this is secret', 'the right passphrase round-trips',
       'got ' + back);

    // the same text encrypted twice must not produce the same blob, or the
    // salt and iv are not being randomised
    const blob2 = await C.encrypt('ayubowan, this is secret', 'correct horse battery');
    ok(blob !== blob2, 'a fresh salt and iv are used every time');

    await C.decrypt(blob, 'wrong passphrase').then(
      () => ok(false, 'a wrong passphrase must fail'),
      (e) => ok(e.message === 'wrong-passphrase', 'a wrong passphrase is rejected',
                'got ' + e.message)
    );

    await C.decrypt('this is not a blob at all', 'x').then(
      () => ok(false, 'rubbish input must fail'),
      (e) => ok(e.message === 'not-a-blob', 'rubbish is told apart from a bad passphrase',
                'got ' + e.message)
    );

    // AES-GCM authenticates, so a tampered blob must not decrypt
    const bytes = Buffer.from(blob, 'base64');
    bytes[bytes.length - 3] ^= 0xFF;
    await C.decrypt(bytes.toString('base64'), 'correct horse battery').then(
      () => ok(false, 'an edited blob must not decrypt'),
      () => ok(true, 'an edited message is detected and refused')
    );

    ok(C.strength('abc').label === 'Weak', 'a short passphrase reads as weak');
    ok(C.strength('correct horse battery staple!').label === 'Very strong',
       'a long passphrase reads as strong');
  });

  // both tools must use the shared file rather than their own copy
  ['text-encryption', 'encrypted-notes'].forEach((slug) => {
    const s = fs.readFileSync(path.join(SRC, 'tools/' + slug + '.html'), 'utf8');
    ok(s.indexOf('crypto.js') !== -1, slug + ' loads the shared crypto');
    // the word PBKDF2 legitimately appears in the page's explanation, so
    // look for an actual implementation instead of a mention of one
    ok(s.indexOf('deriveKey') === -1 && s.indexOf('subtle.encrypt') === -1,
       slug + ' does not implement its own key derivation');
  });
})();

(function hashGenerator() {
  const t = loadTool('hash-generator');
  t.set('in', 'abc');
  pending.push(() => new Promise((resolve) => setTimeout(() => {
    // the published SHA-256 of "abc"
    has(t.text('results'),
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        'SHA-256 of "abc" matches the known value');
    has(t.text('results'), 'a9993e364706816aba3e25717850c26c9cd0d89d',
        'SHA-1 of "abc" matches too');

    t.set('check', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    has(t.text('check-result'), 'matches the SHA-256', 'comparing a known hash works');
    t.set('check', 'deadbeef');
    has(t.text('check-result'), 'No match', 'a wrong hash is reported');
    t.close();
    resolve();
  }, 60)));
})();

(function keyGenerator() {
  const t = loadTool('key-generator');
  t.set('format', 'hex').set('bytes', 32).set('count', 5);
  const vals = () => [...t.document.querySelectorAll('#keys .val')].map((e) => e.textContent);
  ok(vals().length === 5, 'five keys generated', 'got ' + vals().length);
  ok(vals().every((v) => /^[0-9a-f]{64}$/.test(v)),
     '32 bytes of hex is 64 characters', 'got ' + vals()[0]);
  ok(new Set(vals()).size === 5, 'the keys are all different');

  t.set('format', 'uuid');
  ok(vals().every((v) =>
     /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)),
     'UUIDs have the right version and variant bits', 'got ' + vals()[0]);

  t.set('format', 'prefixed').set('prefix', 'sk_live').set('bytes', 24);
  ok(vals().every((v) => v.indexOf('sk_live_') === 0), 'the prefix is applied');
  t.close();
})();

(function encryptedNotes() {
  const t = loadTool('encrypted-notes');
  // nothing stored yet, so it should offer to create rather than unlock
  has(t.text('lock-text'), 'No notes here yet', 'a first visit offers to create');
  ok(!t.byId('confirm-field').hidden, 'and asks for the passphrase twice');

  // mismatched passphrases must be refused
  t.set('pass', 'longenoughpass').set('confirm', 'somethingelse');
  t.click('unlock');
  has(t.text('err-slot'), 'do not match', 'mismatched passphrases are refused');

  // too short must be refused
  t.set('pass', 'short').set('confirm', 'short');
  t.click('unlock');
  has(t.text('err-slot'), 'at least 8', 'a short passphrase is refused');
  t.close();
})();

(function metadataRemover() {
  // The EXIF parser is the part worth testing; the stripping is a canvas
  // redraw, which the stub cannot verify.
  const t = loadTool('metadata-remover');
  ok(t.byId('drop') !== null, 'the drop zone renders');
  ok(t.byId('out-panel').hidden, 'the output stays hidden until a photo is chosen');
  t.close();
})();

// ---------------------------------------------------------------- developers

(function base64Tool() {
  const t = loadTool('base64');
  t.set('in', 'Hello');
  ok(t.byId('out').value === 'SGVsbG8=', 'plain text encodes',
     'got ' + t.byId('out').value);

  // the whole point of going through UTF-8: btoa alone throws on these
  t.set('in', 'අයුබෝවන්');
  const sinhala = t.byId('out').value;
  ok(sinhala.length > 0, 'Sinhala text encodes instead of throwing');

  t.click('tab-decode');
  t.set('in', sinhala);
  ok(t.byId('out').value === 'අයුබෝවන්',
     'and decodes back to the same Sinhala', 'got ' + t.byId('out').value);

  // missing padding is common in the wild and should still decode
  t.set('in', 'SGVsbG8');
  ok(t.byId('out').value === 'Hello', 'Base64 without padding still decodes');

  t.set('in', 'not valid base64!!!');
  has(t.text('err-slot'), 'not valid Base64', 'rubbish is reported');
  t.close();
})();

(function uuidTool() {
  const t = loadTool('uuid-generator');
  t.set('version', '4').set('count', 20);
  const vals = () => [...t.document.querySelectorAll('#list span')].map((e) => e.textContent);
  ok(vals().length === 20, 'twenty generated');
  ok(vals().every((v) =>
     /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)),
     'v4 has the right version and variant bits', 'got ' + vals()[0]);
  ok(new Set(vals()).size === 20, 'all twenty are different');

  t.set('version', '7');
  const v7s = vals();
  ok(v7s.every((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)),
     'v7 sets version 7 and a valid variant', 'got ' + v7s[0]);
  // the point of v7 is that they sort in creation order
  ok(v7s.slice().sort().join() === v7s.join(),
     'v7 values come out already in sorted order');

  t.set('version', '4');
  const opt = (name) => [...t.document.querySelectorAll('#opts .btn')]
    .find((b) => b.dataset.opt === name);
  opt('nodash').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  ok(vals()[0].indexOf('-') === -1, 'dashes can be removed');
  opt('upper').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  ok(vals()[0] === vals()[0].toUpperCase(), 'and uppercased');
  t.close();
})();

(function jwtDecoder() {
  const t = loadTool('jwt-decoder');
  t.click('sample');
  has(t.text('payload'), 'Chamindu', 'the payload is decoded');
  has(t.text('header'), 'HS256', 'the header is decoded');
  has(t.text('claims'), 'Subject', 'standard claims are explained');

  // a token with three parts but rubbish inside
  t.set('token', 'aaa.bbb.ccc');
  has(t.text('status-slot'), 'not readable', 'an undecodable header is reported');

  // wrong number of parts
  t.set('token', 'onlyonepart');
  has(t.text('status-slot'), 'three parts', 'a malformed token is explained');

  // alg none is a genuine security problem and must be called out
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    .toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: '1', exp: 4102444800 }))
    .toString('base64url');

  // an alg of "none" means anyone can forge the token, so it must be called out
  t.set('token', header + '.' + payload + '.');
  has(t.text('status-slot'), 'none', 'the none algorithm is flagged');
  has(t.text('payload'), 'sub', 'and an empty signature segment still decodes');

  // an expired token
  const expired = Buffer.from(JSON.stringify({ sub: '1', exp: 1000000 }))
    .toString('base64url');
  t.set('token', Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url') +
    '.' + expired + '.x');
  has(t.text('status-slot'), 'Expired', 'an expired token is flagged');
  t.close();
})();

(function urlEncoder() {
  const t = loadTool('url-encoder');
  t.set('in', 'a b&c=d');
  ok(t.byId('out').value === 'a%20b%26c%3Dd', 'component encoding escapes & and =',
     'got ' + t.byId('out').value);

  t.set('strength', 'uri');
  ok(t.byId('out').value === 'a%20b&c=d', 'uri encoding leaves the structure alone',
     'got ' + t.byId('out').value);

  t.click('tab-decode');
  t.set('in', 'hello+world%21');
  ok(t.byId('out').value === 'hello world!', 'a plus decodes as a space');

  // the classic failure people come here to debug
  t.set('in', '100%');
  has(t.text('err-slot'), 'two hex digits', 'a lone percent sign is explained');

  t.click('tab-parse');
  t.set('in', 'https://example.com:8080/a/b?x=1&y=hello%20there#frag');
  has(t.text('parts'), 'example.com', 'the host is pulled out');
  has(t.text('parts'), '8080', 'and the port');
  has(t.text('query'), 'hello there', 'query values are decoded');
  t.close();
})();

(function cronBuilder() {
  const t = loadTool('cron-builder');
  t.set('expr', '0 9 * * 1-5');
  has(t.text('plain'), '09:00', 'the time is described');
  has(t.text('plain'), 'Monday', 'and the weekdays');
  ok(t.document.querySelectorAll('#next div').length === 5, 'five next runs shown');

  t.set('expr', '*/15 * * * *');
  has(t.text('plain'), 'Every 15 minutes', 'a regular interval reads as an interval');
  t.set('expr', '0 */6 * * *');
  has(t.text('plain'), 'Every 6 hours', 'stepped hours read the same way');
  t.set('expr', '0,15,40 * * * *');
  has(t.text('plain'), 'minute 40', 'an irregular list is still listed out');

  // the day-of-month and day-of-week OR trap
  t.set('expr', '0 0 1 * 1');
  has(t.text('plain'), 'either, not both', 'the OR trap is called out');

  // bad input must be explained, not crash
  t.set('expr', '0 9 * *');
  has(t.text('plain'), 'five fields', 'too few fields is explained');
  t.set('expr', '99 9 * * *');
  has(t.text('err-slot'), 'outside the range', 'an out-of-range value is explained');
  t.set('expr', 'abc 9 * * *');
  has(t.text('err-slot'), 'not a number', 'nonsense is explained');

  // named months and days should work
  t.set('expr', '0 0 * jan mon');
  has(t.text('plain'), 'Monday', 'named weekdays are understood');
  has(t.text('plain'), 'January', 'named months too');

  // sunday is both 0 and 7
  t.set('expr', '0 0 * * 7');
  has(t.text('plain'), 'Sunday', 'day 7 is read as Sunday');
  t.close();
})();

// ---------------------------------------------------------------- developers, part 2

(function regexTester() {
  const t = loadTool('regex-tester');
  t.set('pattern', '(\\w+)@(\\w+\\.\\w+)').set('flags', 'g');
  t.set('text', 'a@b.com and c@d.lk');
  has(t.text('count'), '2 matches', 'both addresses found');
  has(t.text('matches'), 'a@b.com', 'the match is listed');
  has(t.text('matches'), '1: a', 'capture groups are shown');

  // an invalid pattern must be explained, not thrown
  t.set('pattern', '([unclosed');
  has(t.text('err-slot'), 'not valid', 'a broken pattern is reported');

  // a pattern that can match nothing would loop forever without a guard
  t.set('pattern', 'a*').set('text', 'bbb');
  ok(t.text('count').indexOf('match') !== -1,
     'an empty-match pattern terminates instead of hanging');
  has(t.text('count'), 'empty', 'and says the matches are empty');

  // named groups
  t.set('pattern', '(?<year>\\d{4})-(?<month>\\d{2})').set('text', '2026-10');
  has(t.text('matches'), 'year: 2026', 'named groups are labelled');
  t.close();
})();

(function colorConverter() {
  const t = loadTool('color-converter');
  t.set('input', '#2f6df6');
  has(t.text('formats'), 'rgb(47 109 246)', 'hex to rgb');
  has(t.text('formats'), 'hsl(221 92% 57%)', 'hex to hsl');

  // short hex, rgb and hsl input should all resolve to the same colour
  t.set('input', '#fff');
  has(t.text('formats'), '#ffffff', 'three-digit hex expands');
  t.set('input', 'rgb(255, 0, 0)');
  has(t.text('formats'), '#ff0000', 'legacy comma rgb parses');
  t.set('input', 'hsl(120 100% 50%)');
  has(t.text('formats'), '#00ff00', 'hsl parses');
  t.set('input', 'teal');
  has(t.text('formats'), '#008080', 'a css name parses');

  // contrast: black on white is the maximum 21:1
  t.set('input', '#ffffff');
  has(t.text('contrast'), '21.00:1', 'black on white is 21:1');
  has(t.text('contrast'), 'AAA', 'and grades AAA');

  t.set('input', 'not a colour');
  has(t.text('err-slot'), 'not a colour', 'rubbish is reported');
  t.close();
})();

(function jsonToTypescript() {
  const t = loadTool('json-to-typescript');
  t.set('in', '{"id":1,"name":"x","active":true}');
  const out = () => t.byId('out').value;
  has(out(), 'interface Root', 'an interface is produced');
  has(out(), 'id: number', 'numbers typed');
  has(out(), 'name: string', 'strings typed');
  has(out(), 'active: boolean', 'booleans typed');

  // a nested object becomes its own interface
  t.set('in', '{"user":{"city":"Colombo"}}');
  has(out(), 'interface User', 'nested objects get their own interface');

  // an always-null field cannot be typed, and must say so rather than guess
  t.set('in', '{"note":null}');
  has(out(), 'unknown', 'an always-null field is unknown, not null');
  has(out(), 'always null', 'and it explains why');

  // an empty array says nothing about its contents
  t.set('in', '{"items":[]}');
  has(out(), 'unknown[]', 'an empty array is unknown[]');

  // objects in an array with differing keys merge, missing ones optional
  t.set('in', '[{"a":1},{"a":1,"b":2}]');
  has(out(), 'b?:', 'a key missing from some records becomes optional');

  // a key that is not a valid identifier must be quoted
  t.set('in', '{"my-key":1}');
  has(out(), '"my-key"', 'an awkward key is quoted');

  t.set('in', '{bad json');
  has(t.text('err-slot'), 'not valid JSON', 'broken JSON is reported');
  t.close();
})();

(function minifyBeautify() {
  const t = loadTool('minify-beautify');
  t.set('lang', 'json').set('action', 'minify');
  t.set('in', '{ "a" : 1 , "b" : [ 1 , 2 ] }');
  ok(t.byId('out').value === '{"a":1,"b":[1,2]}', 'JSON minifies',
     'got ' + t.byId('out').value);

  t.set('lang', 'css').set('action', 'minify');
  t.set('in', '/* note */\n.a {\n  color : red ;\n}\n');
  ok(t.byId('out').value === '.a{color:red}', 'CSS minifies and drops the comment',
     'got ' + t.byId('out').value);

  // a semicolon or brace inside a quoted value must not be treated as syntax
  t.set('in', '.a { content: "a; b {c}" ; color : red }');
  ok(t.byId('out').value.indexOf('"a; b {c}"') !== -1,
     'a quoted value survives minifying intact', 'got ' + t.byId('out').value);

  t.set('lang', 'html').set('action', 'minify');
  t.set('in', '<!-- c -->\n<div>  <p>a   b</p>  </div>');
  ok(t.byId('out').value === '<div><p>a b</p></div>', 'HTML minifies',
     'got ' + t.byId('out').value);

  // pre contents must be left exactly alone
  t.set('in', '<div>  <pre>  keep   this  </pre>  </div>');
  ok(t.byId('out').value.indexOf('  keep   this  ') !== -1,
     'pre contents are preserved exactly', 'got ' + t.byId('out').value);

  t.set('lang', 'json').set('in', '{bad');
  has(t.text('err-slot'), 'not valid JSON', 'broken JSON is reported');
  t.close();
})();

(function jsonlViewer() {
  const t = loadTool('jsonl-viewer');
  t.set('in', '{"a":1}\n{"a":2,"b":3}\n{"a":3');
  has(t.text('s-total'), '3', 'three records counted');
  has(t.text('s-bad'), '1', 'one broken line found');
  has(t.text('verdict'), 'line 3', 'and it names the line');
  has(t.text('s-keys'), '2', 'distinct keys counted');

  // blank lines are normal and must not count as broken
  t.set('in', '{"a":1}\n\n{"a":2}\n');
  has(t.text('s-bad'), '0', 'blank lines are not treated as errors');
  has(t.text('s-total'), '2', 'and are not counted as records');
  has(t.text('verdict'), 'Every line is valid', 'a clean file says so');

  // key coverage should show which keys are on every record
  t.set('in', '{"a":1,"b":1}\n{"a":2}');
  has(t.text('keys'), '1/2', 'a key missing from some records is marked');
  t.close();
})();

(function tokenCounter() {
  const t = loadTool('token-counter');
  t.set('in', 'The quick brown fox jumps over the lazy dog.');
  has(t.text('s-chars'), '44', 'characters counted');
  has(t.text('s-words'), '9', 'words counted');

  const low = parseInt(t.text('s-low').replace(/,/g, ''), 10);
  const high = parseInt(t.text('s-high').replace(/,/g, ''), 10);
  ok(low > 0 && high >= low, 'a sensible range is produced',
     'got ' + low + ' to ' + high);
  // 43 characters of plain English should land in single or low double digits
  ok(high < 40, 'plain English is not wildly over-estimated', 'high was ' + high);

  // non-Latin script costs far more tokens per character - the estimate
  // must reflect that rather than treating all characters alike
  t.set('in', 'aaaaaaaaaa');
  const latinHigh = parseInt(t.text('s-high').replace(/,/g, ''), 10);
  t.set('in', 'අයුබෝවන්අය');
  const sinhalaHigh = parseInt(t.text('s-high').replace(/,/g, ''), 10);
  ok(sinhalaHigh > latinHigh,
     'Sinhala is estimated higher per character than Latin',
     'latin ' + latinHigh + ' vs sinhala ' + sinhalaHigh);

  // cost table should price every model and respect the call multiplier
  t.set('in', 'hello world').set('output-tokens', 1000).set('calls', 1);
  has(t.text('costs'), 'Claude Opus 5', 'models are listed');
  has(t.text('costs'), 'Claude Haiku 4.5', 'including the cheaper one');

  t.set('in', '');
  has(t.text('out'), 'Paste some text', 'empty input is handled');
  t.close();
})();

// ---------------------------------------------------------------- developers, part 3

(function diffChecker() {
  const t = loadTool('diff-checker');
  t.set('a', 'one\ntwo\nthree').set('b', 'one\ntwo\nthree');
  has(t.text('verdict'), 'identical', 'matching text is identical');

  // an edited line should read as one change, not an add plus a delete
  t.set('a', 'const x = 1;').set('b', 'const x = 2;');
  has(t.text('s-mod'), '1', 'an edited line counts as changed');
  has(t.text('s-add'), '0', 'not as an addition');
  has(t.text('s-del'), '0', 'nor a deletion');

  // and the changed word should be picked out inside the line
  ok(t.document.querySelector('#diff ins') !== null,
     'the added word is marked inside the line');
  ok(t.document.querySelector('#diff del') !== null,
     'and the removed word too');

  // a genuine insertion is still an addition
  t.set('a', 'a\nc').set('b', 'a\nb\nc');
  has(t.text('s-add'), '1', 'an inserted line is an addition');
  has(t.text('s-mod'), '0', 'and not a change');
  t.close();
})();

(function timestampConverter() {
  const t = loadTool('timestamp-converter');
  t.set('zone', 'UTC');

  // ten digits must read as seconds
  t.set('stamp', '1000000000');
  has(t.text('detected'), 'seconds', 'ten digits read as seconds');
  has(t.text('formats'), '2001-09-09T01:46:40.000Z', 'and convert correctly');

  // thirteen digits must read as milliseconds - read as seconds this would
  // land in the year 33000, which is the bug being guarded against
  t.set('stamp', '1761500000000');
  has(t.text('detected'), 'milliseconds', 'thirteen digits read as milliseconds');
  has(t.text('formats'), '2025-10-26', 'and give a sane date');

  // a date string should convert the other way
  t.set('stamp', '2026-01-01T00:00:00Z');
  has(t.text('formats'), '1767225600', 'a date converts back to a timestamp');

  // epoch zero
  t.set('stamp', '0');
  has(t.text('formats'), '1970-01-01T00:00:00.000Z', 'second zero is the epoch');

  // negative timestamps are before 1970 and must work
  t.set('stamp', '-86400');
  has(t.text('formats'), '1969-12-31', 'a negative timestamp goes before the epoch');

  t.set('stamp', 'not a date');
  has(t.text('err-slot'), 'not a timestamp', 'rubbish is reported');
  t.close();
})();

(function jsonSchemaBuilder() {
  const t = loadTool('json-schema-builder');
  t.set('sample', '{"id":1,"name":"x","active":true}');
  const schema = () => JSON.parse(t.byId('schema').value);
  ok(schema().properties.id.type === 'integer', 'a whole number is an integer');
  ok(schema().properties.name.type === 'string', 'strings typed');
  ok(schema().required.indexOf('id') !== -1, 'present fields are required');

  // a field that is sometimes whole and sometimes not must be number, or the
  // schema would reject half the real data
  t.set('sample', '[{"n":1},{"n":1.5}]');
  ok(schema().items.properties.n.type === 'number',
     'mixed whole and decimal becomes number, not integer',
     'got ' + JSON.stringify(schema().items.properties.n.type));

  // a field missing from some records must not be required
  t.set('sample', '[{"a":1,"b":2},{"a":1}]');
  ok((schema().items.required || []).indexOf('b') === -1,
     'a sometimes-missing field is not required');

  // format detection
  t.set('sample', '{"when":"2026-10-26","mail":"a@b.com"}');
  ok(schema().properties.when.format === 'date', 'a date string gets a date format');
  ok(schema().properties.mail.format === 'email', 'an address gets an email format');

  // the validator should catch a wrong type and a missing required field
  t.set('sample', '{"id":1,"name":"x"}');
  t.set('validate', '{"id":"one"}');
  has(t.text('result-slot'), 'should be integer', 'a wrong type is caught');
  has(t.text('result-slot'), 'required but missing', 'a missing field is caught');

  t.set('validate', '{"id":2,"name":"y"}');
  has(t.text('result-slot'), 'matches the schema', 'valid data passes');
  t.close();
})();

(function curlConverter() {
  const t = loadTool('curl-converter');
  t.set('lang', 'fetch');
  t.set('in', "curl -X POST 'https://api.example.com/x' -H 'Content-Type: application/json' -d '{\"a\":1}'");
  const out = () => t.byId('out').value;
  has(t.text('parsed'), 'POST', 'the method is found');
  has(t.text('parsed'), 'api.example.com', 'the URL is found');
  has(out(), "method: 'POST'", 'fetch code has the method');
  has(out(), 'application/json', 'and the header');

  // -d with no method implies POST
  t.set('in', "curl https://x.com -d 'a=1'");
  has(t.text('parsed'), 'POST', 'a body with no -X implies POST');
  // and cURL would add a content type, so that must be stated not hidden
  has(t.text('warn-slot'), 'urlencoded', 'the implicit content type is explained');

  // a quoted value containing spaces must survive tokenising
  t.set('in', "curl https://x.com -H 'User-Agent: My App 1.0'");
  has(t.text('parsed'), 'My App 1.0', 'a quoted header value keeps its spaces');

  // an unknown flag must be reported, not silently dropped
  t.set('in', 'curl https://x.com --some-unknown-flag');
  has(t.text('warn-slot'), 'not understood', 'unknown flags are reported');

  // other languages
  t.set('in', "curl https://x.com -H 'A: b'");
  t.set('lang', 'python');
  has(out(), 'import requests', 'python output');
  has(out(), 'raise_for_status', 'and it checks the response');
  t.set('lang', 'go');
  has(out(), 'net/http', 'go output');
  t.set('lang', 'axios');
  has(out(), 'axios', 'axios output');

  t.set('in', 'curl');
  has(t.text('err-slot'), 'No URL found', 'a command with no URL is reported');
  t.close();
})();

(function promptCleaner() {
  const t = loadTool('prompt-cleaner');
  const curly = String.fromCharCode(0x201C) + 'hi' + String.fromCharCode(0x201D);
  t.set('in', curly);
  ok(t.byId('out').value === '"hi"', 'curly quotes become straight',
     'got ' + t.byId('out').value);

  // a zero-width space must be removed outright
  t.set('in', 'we' + String.fromCharCode(0x200B) + 'ird');
  ok(t.byId('out').value === 'weird', 'a zero-width space is removed');
  has(t.text('report'), 'Invisible characters', 'and it is reported');

  // a non-breaking space becomes a real space, not nothing
  t.set('in', 'a' + String.fromCharCode(0x00A0) + 'b');
  ok(t.byId('out').value === 'a b', 'a non-breaking space becomes an ordinary one');

  // an em dash
  t.set('in', 'a' + String.fromCharCode(0x2014) + 'b');
  ok(t.byId('out').value === 'a--b', 'an em dash becomes two hyphens');

  // already-plain text should say so rather than inventing findings
  t.set('in', 'plain ascii text');
  has(t.text('report'), 'Nothing needed fixing', 'clean text is recognised');
  ok(t.byId('out').value === 'plain ascii text', 'and is left untouched');
  t.close();
})();

// ---------------------------------------------------------------- developers, part 4 + seo

(function ragChunker() {
  const t = loadTool('rag-chunker');
  // 1000 characters of a repeating sentence, chunked at 200 with no overlap
  const text = 'This is a sentence. '.repeat(50);
  t.set('in', text).set('size', 200).set('overlap', 0).set('mode', 'sentence');
  const count = parseInt(t.text('s-count'), 10);
  ok(count >= 5 && count <= 7, 'a 1000-character document splits into about 5 chunks',
     'got ' + count);
  ok(parseInt(t.text('s-largest').replace(/,/g, ''), 10) <= 200,
     'no chunk exceeds the requested size',
     'largest was ' + t.text('s-largest'));

  // overlap must increase the stored total, and the loop must still terminate
  t.set('overlap', 100);
  const withOverlap = parseInt(t.text('s-count'), 10);
  ok(withOverlap > count, 'overlap produces more chunks',
     'got ' + withOverlap + ' vs ' + count);
  has(t.text('bars-note'), 'more', 'and the extra storage is reported');

  // an overlap as large as the chunk would loop forever if unguarded
  t.set('size', 200).set('overlap', 800);
  ok(parseInt(t.text('s-count'), 10) > 0,
     'an overlap larger than the chunk does not hang');

  // hard mode must cut exactly
  t.set('in', 'abcdefghij'.repeat(30)).set('size', 200).set('overlap', 0).set('mode', 'hard');
  ok(parseInt(t.text('s-largest').replace(/,/g, ''), 10) === 200,
     'hard mode cuts at exactly the size');
  t.close();
})();

(function vectorSimilarity() {
  const t = loadTool('vector-similarity');

  // identical vectors are cosine 1
  t.set('a', '1, 0, 0').set('b', '1, 0, 0');
  has(t.text('verdict'), '1.0000', 'identical vectors are cosine 1');
  has(t.text('verdict'), 'identical', 'and described as such');

  // perpendicular is 0
  t.set('a', '1, 0').set('b', '0, 1');
  has(t.text('verdict'), '0.0000', 'perpendicular vectors are cosine 0');

  // opposite is -1
  t.set('a', '1, 0').set('b', '-1, 0');
  has(t.text('verdict'), '-1.0000', 'opposite vectors are cosine -1');

  // a known case: cosine of (1,1) and (1,0) is 1/sqrt(2); the straight-line
  // distance between them is 1, and the length of (1,1) is sqrt(2)
  t.set('a', '1, 1').set('b', '1, 0');
  has(t.text('metrics'), '0.707107', 'a known cosine value is right');
  has(t.text('metrics'), '1.000000', 'and the Euclidean distance is 1');
  has(t.text('s-norm-a'), '1.4142', 'while the length of A is root two');
  has(t.text('norm-note'), 'not length 1', 'and it says these are not normalised');

  // JSON brackets should be tolerated
  t.set('a', '[1, 0]').set('b', '[1, 0]');
  has(t.text('verdict'), '1.0000', 'bracketed input parses');

  // mismatched lengths cannot be compared
  t.set('a', '1, 0, 0').set('b', '1, 0');
  has(t.text('err-slot'), 'different lengths', 'a length mismatch is explained');

  // a zero vector has no direction, so cosine is undefined not zero
  t.set('a', '0, 0').set('b', '1, 1');
  has(t.text('verdict'), 'Undefined', 'a zero vector gives undefined, not zero');

  t.set('a', '1, two').set('b', '1, 2');
  has(t.text('err-slot'), 'not a number', 'a non-number is reported');
  t.close();
})();

(function chatTranscript() {
  const t = loadTool('chat-transcript');
  t.set('from', 'auto').set('to', 'json');
  t.set('in', 'User: hello\n\nAssistant: hi there');
  const parsed = () => JSON.parse(t.byId('out').value);
  ok(parsed().length === 2, 'two turns parsed', 'got ' + parsed().length);
  ok(parsed()[0].role === 'user', 'the first is the user');
  ok(parsed()[1].role === 'assistant', 'the second is the assistant');
  ok(parsed()[1].content === 'hi there', 'content preserved');

  // roles should be recognised from aliases
  t.set('in', 'Human: a\n\nAI: b\n\nSystem: c');
  const roles = parsed().map((m) => m.role);
  ok(roles.join(',') === 'user,assistant,system',
     'aliases map to the right roles', 'got ' + roles.join(','));

  // an unknown name is a person
  t.set('in', 'Nimali: hello\n\nAssistant: hi');
  ok(parsed()[0].role === 'user', 'an unrecognised name is treated as a user');

  // a sentence containing a colon must not start a new turn
  t.set('in', 'User: note this: it has a colon mid-sentence');
  ok(parsed().length === 1, 'a mid-sentence colon does not split the turn',
     'got ' + parsed().length);

  // reading JSON back in
  t.set('from', 'json').set('to', 'text');
  t.set('in', '[{"role":"user","content":"x"},{"role":"assistant","content":"y"}]');
  ok(t.byId('out').value === 'User: x\n\nAssistant: y', 'JSON converts to text',
     'got ' + JSON.stringify(t.byId('out').value));

  // content as an array of blocks is a real API shape
  t.set('in', '[{"role":"user","content":[{"type":"text","text":"block one"}]}]');
  has(t.byId('out').value, 'block one', 'content given as blocks is flattened');

  // a wrapper object with a messages array
  t.set('in', '{"messages":[{"role":"user","content":"wrapped"}]}');
  has(t.byId('out').value, 'wrapped', 'a messages wrapper is unwrapped');

  t.set('in', '{"nope":1}');
  has(t.text('err-slot'), 'list of messages', 'JSON with no messages is explained');
  t.close();
})();

(function metaTags() {
  const t = loadTool('meta-tags');
  t.set('title', 'My Page').set('desc', 'A description.')
   .set('url', 'https://example.com/a').set('site', 'My Site').set('image', '');
  const out = () => t.byId('out').value;
  has(out(), '<title>My Page</title>', 'the title tag');
  has(out(), 'name="description" content="A description."', 'the description');
  has(out(), 'property="og:title"', 'Open Graph tags');
  has(out(), 'name="twitter:card" content="summary"', 'a summary card with no image');

  // with an image it should become a large card
  t.set('image', 'https://example.com/i.png');
  has(out(), 'summary_large_image', 'an image upgrades the card type');

  // a relative image must be flagged, because it fails silently when shared
  t.set('image', '/local.png');
  has(t.text('p-img'), 'not absolute', 'a relative share image is flagged');

  // a quote in the title must not break the attribute
  t.set('image', '').set('title', 'He said "hi"');
  has(out(), '&quot;hi&quot;', 'a quote in the title is escaped in attributes');

  // length warnings
  t.set('title', 'x'.repeat(90));
  has(t.text('title-len'), 'cut off', 'an over-long title is flagged');
  t.close();
})();

(function robotsTxt() {
  const t = loadTool('robots-txt');
  t.set('preset', 'open');
  has(t.byId('out').value, 'User-agent: *', 'a user-agent group is written');
  has(t.byId('out').value, 'Allow: /', 'with the allow rule');

  // blocking everything is a serious mistake on a live site and must warn
  t.set('preset', 'closed');
  has(t.text('warn-slot'), 'blocks every crawler', 'blocking everything warns');

  // path testing: a disallow should block a matching path
  t.set('preset', 'common');
  t.set('test-path', '/admin/settings').set('test-agent', 'Googlebot');
  has(t.text('test-result'), 'Blocked', '/admin/settings is blocked');
  t.set('test-path', '/about');
  has(t.text('test-result'), 'Allowed', '/about is allowed');

  // a crawler with its own group must not also obey the * group
  t.set('preset', 'noai');
  t.set('test-path', '/anything').set('test-agent', 'GPTBot');
  has(t.text('test-result'), 'Blocked', 'GPTBot follows its own group');
  t.set('test-agent', 'Googlebot');
  has(t.text('test-result'), 'Allowed', 'Googlebot falls back to the * group');

  // a sensitive-looking path should be called out, since the file is public
  t.set('preset', 'open');
  const pathInput = [...t.document.querySelectorAll('#rules input')][0];
  pathInput.value = '/secret-backup.sql';
  pathInput.dispatchEvent(new t.window.Event('input', { bubbles: true }));
  const sel = [...t.document.querySelectorAll('#rules select')]
    .find((s) => s.dataset.f === 'rule');
  sel.value = 'disallow';
  sel.dispatchEvent(new t.window.Event('change', { bubbles: true }));
  has(t.text('warn-slot'), 'advertises', 'a sensitive path is called out');

  // a relative sitemap is ignored by crawlers
  t.set('sitemap', '/sitemap.xml');
  has(t.text('warn-slot'), 'full address', 'a relative sitemap is flagged');
  t.close();
})();

// ---------------------------------------------------------------- seo + misc

(function sitemapGenerator() {
  const t = loadTool('sitemap-generator');
  t.set('base', 'https://example.com').set('in', '/\n/about\n/contact');
  const out = () => t.byId('out').value;
  has(out(), '<loc>https://example.com/</loc>', 'a root path becomes a full address');
  has(out(), '<loc>https://example.com/about</loc>', 'and so does a sub-path');
  has(t.text('s-count'), '3', 'three pages counted');

  // a comment and a blank line must not become entries
  t.set('in', '/a\n\n/b   # a note\n');
  has(t.text('s-count'), '2', 'comments and blank lines are ignored');
  ok(out().indexOf('a note') === -1, 'the comment text does not reach the XML');

  // an address on another site would make the whole file invalid
  t.set('in', '/a\nhttps://other.com/x');
  has(t.text('s-skipped'), '1', 'an off-site address is skipped');
  has(t.text('warn-slot'), 'same site', 'and explained');

  // duplicates
  t.set('in', '/a\n/a\n/b');
  has(t.text('s-count'), '2', 'duplicates are removed');

  // an ampersand in a query string must be escaped or the XML is broken
  t.set('in', '/search?a=1&b=2');
  has(out(), '&amp;', 'an ampersand is escaped for XML');

  // blocking the whole site with http should warn about the scheme
  t.set('base', 'http://example.com').set('in', '/a');
  has(t.text('warn-slot'), 'plain http', 'a plain http base is flagged');
  t.close();
})();

(function keywordDensity() {
  const t = loadTool('keyword-density');
  t.set('in', 'tea tea tea coffee sugar');
  has(t.text('s-words'), '5', 'words counted');
  has(t.text('results'), 'tea', 'the repeated word is listed');
  has(t.text('results'), '3', 'with its count');

  // common words should be excluded by default so the subject shows through
  t.set('in', 'the the the the the tools tools');
  const shown = t.text('results');
  ok(shown.indexOf('tools') !== -1, 'the meaningful word is listed');

  // over-repetition should be flagged
  t.set('in', ('tea ' + 'word '.repeat(19)).trim());
  t.set('min', 1);
  // 'tea' is 1 of 20 words = 5%, above the 4% flag
  has(t.text('warn-slot'), '4%', 'over-repetition is flagged');

  // a very short text should say the numbers are unreliable
  t.set('in', 'just a few words here');
  has(t.text('warn-slot'), 'swing wildly', 'a short text is called out');
  t.close();
})();

(function socialPreview() {
  const t = loadTool('social-preview');
  t.set('title', 'A short title').set('desc', 'A description.')
   .set('url', 'https://example.com').set('image', '');
  has(t.text('cards'), 'Facebook', 'platforms are listed');
  has(t.text('cards'), 'WhatsApp', 'including WhatsApp');
  has(t.text('cards'), 'example.com', 'the host is shown');
  has(t.text('warn-slot'), 'No share image', 'a missing image is flagged');

  // a relative image fails silently once shared, so it must be called out
  t.set('image', '/local.png');
  has(t.text('warn-slot'), 'relative', 'a relative image is flagged');

  // a long title must be reported as cut per platform
  t.set('image', 'https://example.com/i.png').set('title', 'x'.repeat(100));
  has(t.text('cards'), 'Title cut at 65', 'WhatsApp truncation is reported');
  has(t.text('cards'), 'Title cut at 70', 'and X truncation too');

  // LinkedIn shows no description at all
  t.set('title', 'Short');
  has(t.text('cards'), 'no description', 'LinkedIn behaviour is noted');
  t.close();
})();

(function typingTest() {
  const t = loadTool('typing-test');
  ok(t.byId('passage').textContent.trim().length > 0, 'a passage is generated');
  has(t.text('verdict'), 'Start typing', 'it waits for the first keystroke');
  ok(t.document.querySelectorAll('#passage span').length > 0,
     'the passage is rendered character by character');

  // typing the passage exactly should finish it at 100% accuracy
  const passage = [...t.document.querySelectorAll('#passage span')]
    .map((s) => (s.textContent === ' ' ? ' ' : s.textContent)).join('');
  t.set('typed', passage);
  has(t.text('s-acc'), '100%', 'typing it exactly gives full accuracy');
  has(t.text('s-errors'), '0', 'and no mistakes');
  has(t.text('verdict'), 'words per minute', 'a result is reported');

  t.close();
})();

(function boxGenerator() {
  const t = loadTool('box-generator');
  t.set('w', 100).set('d', 70).set('h', 50).set('thickness', 0.5)
   .set('glue', 12).set('lid', 'open').set('inside', false);
  ok(t.document.querySelector('#preview svg') !== null, 'a template is drawn');
  ok(t.document.querySelectorAll('#preview path').length === 2,
     'cuts and folds are separate paths');

  // volume comes from the entered dimensions: 100*70*50mm = 350ml
  has(t.text('s-volume'), '350 ml', 'the capacity is worked out');

  // the wrapped band of walls is (w+d)*2 = 340, plus a 12mm glue tab and a
  // 6mm margin on each side = 364
  has(t.text('s-sheet'), '364', 'the sheet width is the walls, tab and margins');

  // inside measurements must grow the box, not shrink it
  t.set('inside', true);
  const withInside = t.text('s-sheet');
  t.set('inside', false);
  const withOutside = t.text('s-sheet');
  ok(parseInt(withInside, 10) > parseInt(withOutside, 10),
     'inside measurements produce a larger template',
     withInside + ' vs ' + withOutside);

  // thick material cannot be folded on a score line
  t.set('thickness', 3);
  has(t.text('warn-slot'), 'too thick', 'thick material is flagged');

  // no glue tab means it needs tape
  t.set('thickness', 0.5).set('glue', 0);
  has(t.text('warn-slot'), 'tape', 'a missing glue tab is flagged');

  // something far too big for any sheet
  t.set('glue', 12).set('w', 500).set('d', 500).set('h', 500);
  has(t.text('warn-slot'), 'larger than', 'an oversized template is flagged');
  t.close();
})();

// ---------------------------------------------------------------- time

(function sharedStore() {
  // The store helper is what every data-keeping tool now relies on, so its
  // failure behaviour matters more than its success behaviour.
  const code = fs.readFileSync(path.join(SRC, 'assets/store.js'), 'utf8');

  // a working localStorage
  const good = (() => {
    const box = {};
    return {
      getItem: (k) => (k in box ? box[k] : null),
      setItem: (k, v) => { box[k] = String(v); },
      removeItem: (k) => { delete box[k]; }
    };
  })();
  const S = new Function('localStorage', code + '; return CJA_STORE;')(good);
  ok(S.available(), 'reports available when storage works');
  ok(S.set('k', { a: 1 }) === true, 'a write reports success');
  ok(S.get('k', null).a === 1, 'and reads back');
  ok(S.get('missing', 'fallback') === 'fallback', 'a missing key gives the fallback');
  has(S.note(), 'does not sync', 'the note explains the limitation');

  // corrupt data must give the fallback, not throw into a tool's startup
  good.setItem('bad', '{not json');
  ok(S.get('bad', 'fallback') === 'fallback', 'corrupt data gives the fallback');

  // a private window, where every call throws
  const broken = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
    removeItem: () => { throw new Error('denied'); }
  };
  const B = new Function('localStorage', code + '; return CJA_STORE;')(broken);
  ok(B.available() === false, 'reports unavailable when storage throws');
  ok(B.set('k', 1) === false, 'a failed write reports failure rather than throwing');
  ok(B.get('k', 'fallback') === 'fallback', 'a failed read gives the fallback');
  has(B.note(), 'not available', 'and the note says so plainly');

  // every tool that keeps data must use it rather than its own try/catch
  ['pomodoro', 'alarm-clock', 'todo-list', 'habit-tracker', 'birthday-reminder']
    .forEach((slug) => {
      const s = fs.readFileSync(path.join(SRC, 'tools/' + slug + '.html'), 'utf8');
      ok(s.indexOf('store.js') !== -1, slug + ' loads the shared store');
      ok(s.indexOf('localStorage.setItem') === -1,
         slug + ' does not touch localStorage directly');
    });
})();

(function pomodoro() {
  const t = loadTool('pomodoro');
  t.set('work', 25).set('short', 5).set('long', 15).set('rounds', 4);
  has(t.text('clock'), '25:00', 'the clock shows the work length');
  has(t.text('phase'), 'Ready', 'and waits to be started');
  ok(t.document.querySelectorAll('#dots i').length === 4,
     'one dot per round before a long break');

  t.set('work', 50);
  has(t.text('clock'), '50:00', 'changing the length updates the clock');

  // skipping a work session should count it and move to a break
  t.click('skip');
  has(t.text('phase'), 'break', 'finishing work leads to a break');
  has(t.text('s-today'), '1', 'and the session is counted');
  t.close();
})();

(function alarmClock() {
  const t = loadTool('alarm-clock');
  has(t.text('alarms'), 'No alarms set', 'it starts empty');

  t.set('time', '07:30').set('label', 'Wake up').set('repeat', 'daily');
  t.click('add');
  has(t.text('alarms'), '07:30', 'the alarm is listed');
  has(t.text('alarms'), 'Wake up', 'with its label');
  has(t.text('alarms'), 'Every day', 'and its repeat');
  has(t.text('next-note'), 'Next alarm', 'and the next one is announced');

  // adding without a time must not create a broken alarm
  t.set('time', '');
  t.click('add');
  ok((t.text('alarms').match(/07:30/g) || []).length === 1,
     'adding with no time does nothing');
  t.close();
})();

(function todoList() {
  const t = loadTool('todo-list');
  has(t.text('items'), 'Nothing on the list', 'it starts empty');

  t.set('what', 'Buy tea');
  t.click('add');
  has(t.text('items'), 'Buy tea', 'the task is listed');
  has(t.text('summary'), '1 still to do', 'and counted');

  // an empty task must not be added
  t.set('what', '   ');
  t.click('add');
  has(t.text('summary'), '1 still to do', 'a blank task is refused');

  // ticking it off
  const cb = t.document.querySelector('#items input[type="checkbox"]');
  cb.checked = true;
  cb.dispatchEvent(new t.window.Event('change', { bubbles: true }));
  has(t.text('summary'), '0 still to do', 'ticking it off updates the count');
  has(t.text('summary'), '1 of 1 finished', 'and the finished tally');

  // an overdue task should be flagged
  t.set('filter', 'all');
  t.set('what', 'Late thing').set('due', '2020-01-01');
  t.click('add');
  has(t.text('summary'), 'past its due date', 'an overdue task is flagged');
  t.close();
})();

(function habitTracker() {
  const t = loadTool('habit-tracker');
  has(t.text('habits'), 'No habits yet', 'it starts empty');

  t.set('name', 'Walk');
  t.click('add');
  has(t.text('habits'), 'Walk', 'the habit is listed');
  has(t.text('s-today'), '0 of 1', 'nothing done yet today');

  // marking today
  const tick = t.document.querySelector('#habits [data-tick]');
  tick.dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  has(t.text('s-today'), '1 of 1', 'marking today is counted');
  has(t.text('habits'), '1 day', 'and the streak starts');

  // unmarking should take it back off
  t.document.querySelector('#habits [data-tick]')
   .dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  has(t.text('s-today'), '0 of 1', 'unmarking removes it again');

  // the grid should have one square per day in the chosen span
  t.set('span', '28');
  ok(t.document.querySelectorAll('#habits .grid i').length === 28,
     'one square per day');
  t.close();
})();

(function birthdayReminder() {
  const t = loadTool('birthday-reminder');
  has(t.text('list'), 'Nobody on the list', 'it starts empty');

  t.set('name', 'Nimali').set('dob', '1995-06-15').set('no-year', false);
  t.click('add');
  has(t.text('list'), 'Nimali', 'the person is listed');
  has(t.text('list'), '15 June 1995', 'with their date');
  has(t.text('next'), 'Nimali', 'and announced as next');

  // with no year known, no age should be invented
  t.set('name', 'Perera').set('dob', '2000-03-02').set('no-year', true);
  t.click('add');
  t.set('sort', 'date');
  const list = t.text('list');
  ok(list.indexOf('2 March 2000') === -1,
     'a year is not shown when it is not known', 'got: ' + list.slice(0, 200));

  // a missing name must not create a blank entry
  t.set('name', '').set('dob', '1990-01-01');
  t.click('add');
  ok((t.text('list').match(/Nimali/g) || []).length === 1,
     'adding with no name does nothing');
  t.close();
})();

// ---------------------------------------------------------------- time, part 2

(function storeAdoption() {
  // every tool that keeps data must go through the shared store
  ['document-expiry', 'vehicle-reminder', 'meeting-planner', 'event-countdown']
    .forEach((slug) => {
      const s = fs.readFileSync(path.join(SRC, 'tools/' + slug + '.html'), 'utf8');
      ok(s.indexOf('store.js') !== -1, slug + ' loads the shared store');
      ok(s.indexOf('localStorage.setItem') === -1,
         slug + ' does not touch localStorage directly');
    });
})();

(function documentExpiry() {
  const t = loadTool('document-expiry');
  has(t.text('list'), 'Nothing tracked yet', 'it starts empty');

  const iso = (daysFromNow) => {
    const d = new Date(Date.now() + daysFromNow * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  };

  // something far away is fine
  t.set('name', 'Passport').set('expires', iso(400)).set('warn', '90');
  t.click('add');
  has(t.text('list'), 'Passport', 'the document is listed');
  has(t.text('list'), 'Fine', 'a distant expiry is fine');
  has(t.text('s-soon'), '0', 'nothing needs attention yet');

  // the status uses each document's own warning period, not a global one
  t.set('name', 'Insurance').set('expires', iso(45)).set('warn', '30');
  t.click('add');
  t.set('name', 'Visa').set('expires', iso(45)).set('warn', '90');
  t.click('add');
  // 45 days out: fine at a 30-day warning, "renew soon" at a 90-day one
  has(t.text('list'), 'Renew soon', 'a longer warning period triggers earlier');
  has(t.text('s-soon'), '1', 'only the one with the longer warning counts');

  // an expired document
  t.set('name', 'Old licence').set('expires', iso(-10)).set('warn', '30');
  t.click('add');
  has(t.text('s-gone'), '1', 'an expired document is counted');
  has(t.text('next'), 'expired', 'and leads the headline');

  // adding with no date must do nothing
  t.set('name', 'No date').set('expires', '');
  t.click('add');
  has(t.text('s-total'), '4', 'adding without a date is refused');
  t.close();
})();

(function vehicleReminder() {
  const t = loadTool('vehicle-reminder');
  t.set('plate', 'cab-1234').set('name', 'The van').set('odo', 85000);
  t.click('add');
  has(t.text('vehicles'), 'CAB-1234', 'the plate is upper-cased');
  has(t.text('vehicles'), 'The van', 'and the description kept');
  has(t.text('vehicles'), 'Insurance', 'the four items are shown');
  has(t.text('vehicles'), 'Revenue licence', 'including the revenue licence');
  has(t.text('vehicles'), 'Emission test', 'and the emission test');
  has(t.text('vehicles'), 'not set', 'with empty dates marked as not set');

  // a plate is required
  t.set('plate', '');
  t.click('add');
  ok((t.text('vehicles').match(/CAB-1234/g) || []).length === 1,
     'adding without a plate does nothing');
  t.close();
})();

(function intervalTimer() {
  const t = loadTool('interval-timer');
  t.set('work', 30).set('rest', 15).set('rounds', 8).set('prep', 10);
  has(t.text('time'), '00:10', 'it starts on the get-ready period');
  has(t.text('round'), '8 rounds', 'and describes the plan');

  // 10 prep + 8 work of 30 + 7 rests of 15 = 10 + 240 + 105 = 355s
  has(t.text('s-total'), '5m 55s', 'the session length excludes a trailing rest');
  has(t.text('s-working'), '4m', 'and the working total is just the work');
  has(t.text('s-done'), '0 of 8', 'no rounds done yet');

  // the plan bar should have 8 work blocks and 7 rests, not 8 of each
  const blocks = [...t.document.querySelectorAll('#plan i')];
  ok(blocks.filter((b) => b.className.indexOf('w') !== -1).length === 8,
     'eight work blocks');
  ok(blocks.filter((b) => b.className.indexOf('r') !== -1).length === 7,
     'and seven rests, not eight',
     'got ' + blocks.filter((b) => b.className.indexOf('r') !== -1).length);

  // with no rest at all there should be no rest blocks
  t.set('rest', 0);
  ok([...t.document.querySelectorAll('#plan i')]
     .filter((b) => b.className.indexOf('r') !== -1).length === 0,
     'zero rest means no rest blocks');
  t.close();
})();

(function meetingPlanner() {
  const t = loadTool('meeting-planner');
  t.set('base', 'UTC').set('date', '2026-11-03');
  has(t.text('rows'), 'Colombo', 'the default people are shown');
  has(t.text('rows'), 'London', 'including London');

  // 24 cells per person, plus the name and the remove button
  const firstRow = t.document.querySelector('#rows .prow');
  ok(firstRow.querySelectorAll('i').length === 24, 'one cell per hour');

  // the score row should total the people available each hour
  ok(t.document.querySelectorAll('#scores i').length === 24,
     'a score for every hour');
  has(t.text('best'), 'in UTC', 'the verdict names the base zone');

  // a single person in one zone should have 8 good hours for 9 to 17
  t.set('who', 'Solo').set('zone', 'UTC').set('from', 9).set('to', 17);
  t.click('add');
  const soloRow = [...t.document.querySelectorAll('#rows .prow')]
    .find((r) => r.textContent.indexOf('Solo') === 0);
  ok(soloRow.querySelectorAll('i.h-good').length === 8,
     '9 to 17 is eight working hours',
     'got ' + soloRow.querySelectorAll('i.h-good').length);
  t.close();
})();

(function eventCountdown() {
  const t = loadTool('event-countdown');
  has(t.text('hero'), 'Nothing added yet', 'it starts empty');

  const future = new Date(Date.now() + 10 * 86400000);
  const pad = (x) => String(x).padStart(2, '0');
  const local = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' +
    pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());

  t.set('name', 'Exam').set('when', local(future));
  t.click('add');
  has(t.text('hero'), 'Exam', 'the event becomes the headline');
  has(t.text('list'), 'Exam', 'and is listed');

  // a date in the past should count upwards, not be hidden
  const past = new Date(Date.now() - 5 * 86400000);
  t.set('name', 'Gone by').set('when', local(past));
  t.click('add');
  has(t.text('list'), 'Gone by', 'a past event is kept');
  has(t.text('list'), 'days ago', 'and counts upwards');
  // the upcoming one should still be the headline, not the past one
  has(t.text('hero'), 'Exam', 'the headline stays on the upcoming event');

  // no name means no entry
  t.set('name', '').set('when', local(future));
  t.click('add');
  ok((t.text('list').match(/Exam/g) || []).length === 1,
     'adding without a name does nothing');
  t.close();
})();

// ---------------------------------------------------------------- generators

(function barcodeGenerator() {
  const t = loadTool('barcode-generator');
  t.set('kind', 'ean13');

  // check digits verified against published barcodes
  const cases = [
    ['590123412345', '7'],
    ['400638133393', '1'],
    ['978030640615', '7'],   // ISBN-13 9780306406157
    ['400399415548', '6']
  ];
  cases.forEach(([body, want]) => {
    t.set('code', body);
    has(t.text('msg-slot'), 'Check digit ' + want + ' added',
        'check digit for ' + body + ' is ' + want);
  });

  // a wrong check digit must be refused loudly, not quietly drawn
  t.set('code', '5901234123450');
  has(t.text('msg-slot'), 'does not match', 'a wrong check digit is caught');
  has(t.text('msg-slot'), 'should be 7', 'and the right one given');

  // a correct full code should be confirmed
  t.set('code', '5901234123457');
  has(t.text('msg-slot'), 'is correct', 'a correct check digit is confirmed');

  // the barcode should actually be drawn
  ok(t.document.querySelector('#box svg') !== null, 'an SVG barcode is drawn');
  // an EAN-13 is 95 modules, of which roughly half are bars, plus the
  // background rect - so around 50 is what a correct code looks like
  const bars = t.document.querySelectorAll('#box svg rect').length;
  ok(bars > 40 && bars < 70, 'with the right sort of bar count', 'got ' + bars);

  // too few digits
  t.set('code', '123');
  has(t.text('msg-slot'), 'needs 12', 'a short code is explained');

  // EAN-8 takes 8 digits
  t.set('kind', 'ean8').set('code', '9638507');
  has(t.text('msg-slot'), 'Check digit', 'EAN-8 works too');
  t.close();
})();

(function randomNumber() {
  const t = loadTool('random-number');
  t.set('min', 1).set('max', 6).set('count', 1);
  const value = () => parseInt(t.text('out'), 10);
  ok(value() >= 1 && value() <= 6, 'a single pick is inside the range',
     'got ' + t.text('out'));

  // many picks, all inside the range
  t.set('count', 50);
  const picks = [...t.document.querySelectorAll('#picks i')].map((e) => +e.textContent);
  ok(picks.length === 50, 'fifty picks produced', 'got ' + picks.length);
  ok(picks.every((p) => p >= 1 && p <= 6), 'all inside the range');

  // asking for more unique values than exist must cap and say so
  const opt = (name) => [...t.document.querySelectorAll('#opts .btn')]
    .find((b) => b.dataset.opt === name);
  opt('unique').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  has(t.text('note'), 'Only 6 different numbers',
      'asking for too many unique values is explained');
  const unique = [...t.document.querySelectorAll('#picks i')].map((e) => +e.textContent);
  ok(unique.length === 6, 'and capped at the range size', 'got ' + unique.length);
  ok(new Set(unique).size === 6, 'with no repeats');

  // a reversed range should be handled, not produce nothing
  opt('unique').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  t.set('count', 1).set('min', 10).set('max', 2);
  ok(value() >= 2 && value() <= 10, 'a backwards range is swapped round',
     'got ' + t.text('out'));
  t.close();
})();

(function wheelSpinner() {
  const t = loadTool('wheel-spinner');
  has(t.text('count-note'), '6 options', 'the example options are counted');
  has(t.text('count-note'), '16.7%', 'with an equal share each');
  ok(t.byId('wheel') !== null, 'the wheel canvas exists');
  ok(t.byId('wheel').__ctx.calls.some((c) => c[0] === 'arc'),
     'segments are drawn');

  t.set('entries', 'one\ntwo');
  has(t.text('count-note'), '2 options', 'changing the list recounts');
  has(t.text('count-note'), '50.0%', 'and recalculates the share');

  t.set('entries', '');
  has(t.text('count-note'), 'at least one', 'an empty list says so');
  t.close();
})();

(function usernameGenerator() {
  const t = loadTool('username-generator');
  t.set('style', 'adjnoun').set('count', 20);
  const names = () => [...t.document.querySelectorAll('#list .name')]
    .map((e) => e.textContent);
  ok(names().length === 20, 'twenty names produced', 'got ' + names().length);
  ok(new Set(names()).size === 20, 'all different');
  ok(names().every((n) => /^[a-z]+$/.test(n)),
     'plain lowercase letters by default', 'got ' + names()[0]);
  ok(names().every((n) => n.length <= 16),
     'the length limit is respected', 'longest was ' +
     Math.max(...names().map((n) => n.length)));

  // the options should change the shape
  const opt = (name) => [...t.document.querySelectorAll('#opts .btn')]
    .find((b) => b.dataset.opt === name);
  opt('separator').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  ok(names().every((n) => n.indexOf('.') !== -1), 'a separator is added');
  opt('numbers').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  ok(names().every((n) => /\d\d$/.test(n)), 'digits are added at the end');

  // building from a name should keep that name in it
  t.set('style', 'fromname').set('seed', 'chamindu');
  ok(names().every((n) => n.toLowerCase().indexOf('chamindu') !== -1),
     'the seed name appears in every result');

  t.set('seed', '');
  has(t.text('list'), 'Enter a name', 'an empty seed is explained');
  t.close();
})();

(function fakeData() {
  const t = loadTool('fake-data');
  t.set('rows', 30).set('format', 'json').set('flavour', 'lk');
  const rows = () => JSON.parse(t.byId('out').value);
  ok(rows().length === 30, 'thirty rows produced', 'got ' + rows().length);

  // emails must be unreachable by design
  ok(rows().every((r) => /@example\.com$/.test(r.email)),
     'every email uses the reserved example.com domain');

  // age must agree with the date of birth rather than being independent
  const fieldBtn = (label) => [...t.document.querySelectorAll('#fields .btn')]
    .find((b) => b.textContent === label);
  fieldBtn('date of birth').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  const withDob = rows();
  ok(withDob.every((r) => {
    const born = new Date(r.dob);
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age--;
    return Math.abs(age - r.age) <= 1;
  }), 'age agrees with the date of birth');

  // the order total must follow from the product and quantity
  ['product', 'quantity', 'order total'].forEach((l) => {
    fieldBtn(l).dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  });
  const withOrders = rows();
  ok(withOrders.every((r) => {
    const unit = parseFloat(r.total) / r.quantity;
    return Number.isFinite(unit) && unit > 0;
  }), 'the total divides cleanly by the quantity');

  // CSV output must have a header and the right number of lines
  t.set('format', 'csv');
  const lines = t.byId('out').value.split('\n');
  ok(lines.length === 31, 'CSV has a header plus thirty rows', 'got ' + lines.length);

  // SQL output must quote strings and not numbers
  t.set('format', 'sql');
  has(t.byId('out').value, 'INSERT INTO people', 'SQL inserts are produced');
  has(t.byId('out').value, "'", 'with quoted strings');

  // turning every column off must be handled
  [...t.document.querySelectorAll('#fields .btn.primary')].forEach((b) => {
    b.dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  });
  has(t.text('body'), 'at least one column', 'no columns selected is explained');
  t.close();
})();

// ---------------------------------------------------------------- generators, part 2 + world

(function coinFlip() {
  const t = loadTool('coin-flip');
  has(t.text('verdict'), 'Click the coin', 'it waits to be flipped');

  // a batch of 100 must tally exactly, with no flips lost
  [...t.document.querySelectorAll('[data-batch]')]
    .find((b) => b.dataset.batch === '100')
    .dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  const heads = parseInt(t.text('n-heads'), 10);
  const tails = parseInt(t.text('n-tails'), 10);
  ok(heads + tails === 100, 'every flip is counted', 'got ' + heads + '+' + tails);
  ok(heads > 20 && heads < 80, 'and the split is not absurd', 'got ' + heads + ' heads');
  has(t.text('tally-note'), '100 flip', 'the tally reports the total');

  // the strip shows the last 60 at most
  ok(t.document.querySelectorAll('#run i').length === 60,
     'the strip is capped at 60', 'got ' + t.document.querySelectorAll('#run i').length);

  t.click('reset');
  has(t.text('n-heads'), '0', 'reset clears the tally');
  t.close();
})();

(function businessName() {
  const t = loadTool('business-name');
  t.set('word', '').set('kind', 'compound').set('count', 12).set('tld', '.lk');
  const names = () => [...t.document.querySelectorAll('#list .name')]
    .map((e) => e.childNodes[0].textContent.trim());
  ok(names().length === 12, 'twelve ideas produced', 'got ' + names().length);
  ok(new Set(names()).size === 12, 'all different');
  has(t.text('list'), '.lk', 'the domain is shown');

  // a seed word should appear in at least some results
  t.set('word', 'tea').set('kind', 'prefix');
  ok(names().some((n) => n.toLowerCase().indexOf('tea') !== -1),
     'the seed word is used');

  // the spelling-risk flag should fire on a doubled letter at a word join
  t.set('kind', 'compound').set('count', 40).set('word', '');
  const flags = [...t.document.querySelectorAll('#list .flag')]
    .map((e) => e.textContent).filter((s) => s);
  ok(flags.length > 0, 'some names are flagged as awkward to spell',
     'got ' + flags.length + ' flags');
  t.close();
})();

(function teamPicker() {
  const t = loadTool('team-picker');
  has(t.text('count-note'), '11 name', 'the example list is counted');

  // eleven people into three teams must be 4,4,3 - not 5,3,3
  t.set('mode', 'teams').set('n', 3);
  t.click('split');
  const sizes = [...t.document.querySelectorAll('#teams .team ol')]
    .map((o) => o.children.length).sort((a, b) => b - a);
  ok(sizes.join(',') === '4,4,3', 'eleven across three teams is 4, 4 and 3',
     'got ' + sizes.join(','));
  ok(sizes.reduce((a, b) => a + b, 0) === 11, 'and nobody is lost');
  has(t.text('split-note'), 'as even as it goes', 'the uneven split is explained');

  // nobody should appear twice
  const all = [...t.document.querySelectorAll('#teams .team li')]
    .map((li) => li.textContent);
  ok(new Set(all).size === 11, 'nobody is in two teams');

  // by size instead
  t.set('mode', 'size').set('n', 4);
  t.click('split');
  ok(t.document.querySelectorAll('#teams .team').length === 3,
     'eleven in groups of four makes three teams',
     'got ' + t.document.querySelectorAll('#teams .team').length);

  // drawing must not repeat anyone
  t.click('tab-draw');
  for (let i = 0; i < 11; i++) t.click('draw');
  t.click('draw');
  has(t.text('drawn'), 'Everyone has been drawn', 'drawing stops when the list runs out');
  t.close();
})();

(function qrScanner() {
  const t = loadTool('qr-scanner');
  ok(t.byId('drop') !== null, 'the image drop zone renders');
  ok(t.byId('result-panel').hidden, 'no result is shown until something is read');
  ok(typeof t.window.jsQR === 'function', 'the vendored decoder loaded');

  // the vendored file must carry its Apache-2.0 attribution
  const vendored = fs.readFileSync(path.join(SRC, 'assets/vendor/jsqr.js'), 'utf8');
  has(vendored.slice(0, 500), 'Apache License', 'the decoder keeps its licence header');
  has(vendored.slice(0, 500), 'jsQR', 'and names the library');
  t.close();
})();

(function morseCode() {
  const t = loadTool('morse-code');
  t.set('in', 'SOS');
  ok(t.byId('out').value === '... --- ...', 'SOS encodes correctly',
     'got ' + JSON.stringify(t.byId('out').value));

  t.set('in', 'HELLO WORLD');
  has(t.byId('out').value, '/', 'a word gap is marked with a slash');
  ok(t.byId('out').value.indexOf('.... . .-.. .-.. ---') === 0,
     'HELLO encodes correctly', 'got ' + t.byId('out').value);

  // decoding back
  t.click('tab-decode');
  t.set('in', '... --- ...');
  ok(t.byId('out').value === 'SOS', 'Morse decodes back to SOS',
     'got ' + t.byId('out').value);

  t.set('in', '.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
  ok(t.byId('out').value === 'HELLO WORLD', 'a full phrase decodes',
     'got ' + t.byId('out').value);

  // SOS with no gaps is a single prosign, not a letter sequence. Read as
  // letters it is validly "3B", so it needs its own entry.
  t.set('in', '...---...');
  ok(t.byId('out').value === 'SOS', 'the SOS prosign is recognised',
     'got ' + t.byId('out').value);

  // any other gapless run is genuinely ambiguous and must say so
  t.set('in', '.-.-');
  has(t.text('err-slot'), 'no gaps between letters',
      'an ambiguous run is flagged rather than guessed at silently');
  has(t.text('err-slot'), 'is a guess', 'and the reading is called a guess');

  // something that is not Morse at all
  t.set('in', '..--..--..--xyz');
  has(t.text('err-slot'), 'could not be read', 'rubbish is reported');

  // an unencodable character on the way in
  t.click('tab-encode');
  t.set('in', 'hi අ');
  has(t.text('err-slot'), 'no code for', 'a character with no Morse is reported');
  t.close();
})();

(function natoAlphabet() {
  const t = loadTool('nato-alphabet');
  t.set('in', 'CAB');
  ok(t.byId('out').value === 'Charlie Alfa Bravo', 'letters spell out correctly',
     'got ' + t.byId('out').value);

  // the digits are written normally but pronounced oddly - the written word
  // is NINE, said as NIN-er, so both need to appear in the right place
  t.set('in', '94');
  ok(t.byId('out').value === 'Nine Four', 'digits use the standard written words',
     'got ' + t.byId('out').value);
  has(t.text('key'), 'NIN-er', 'the pronunciation guide shows nine as NIN-er');
  has(t.text('key'), 'FOW-er', 'and four as FOW-er');

  // "capital" should only appear when the text genuinely mixes cases
  t.set('in', 'CAB');
  ok(t.byId('out').value.indexOf('capital') === -1,
     'all-caps text does not say capital on every letter');
  t.set('in', 'Cab');
  has(t.byId('out').value, 'capital Charlie', 'mixed case does mark the capital');

  // punctuation passes through unless asked for
  t.set('in', 'A-1');
  ok(t.byId('out').value === 'Alfa - One', 'punctuation is left as a symbol',
     'got ' + t.byId('out').value);
  const opt = (name) => [...t.document.querySelectorAll('#opts .btn')]
    .find((b) => b.dataset.opt === name);
  opt('full').dispatchEvent(new t.window.MouseEvent('click', { bubbles: true }));
  has(t.byId('out').value, 'dash', 'turning it on spells the punctuation out');
  t.close();
})();

// ---------------------------------------------------------------- braille

(function () {
  const t = loadTool('braille');
  t.set('text', 'Hi 42');
  ok(t.byId('braille').value === '⠠⠓⠊ ⠼⠙⠃',
     'capital sign, letters and a number sign come out right',
     'got ' + t.byId('braille').value);

  t.set('text', 'NASA');
  ok(t.byId('braille').value.indexOf('⠠⠠') === 0,
     'an all-capitals word gets the double capital sign');

  // a letter a-j straight after digits needs the "letters again" sign
  t.set('text', '3a');
  ok(t.byId('braille').value === '⠼⠉⠰⠁',
     'a letter after a number is marked so it is not read as a digit',
     'got ' + t.byId('braille').value);

  // round trip through the Braille box
  const words = 'Hello World, 1,250.75 is NOT a-b?';
  t.set('text', words);
  const br = t.byId('braille').value;
  t.set('braille', br);
  ok(t.byId('text').value === words, 'text survives a round trip through Braille',
     'got ' + t.byId('text').value);

  t.set('text', 'café');
  has(t.text('note'), 'é', 'characters with no Grade 1 cell are pointed out');
  t.close();
})();

// ---------------------------------------------------------------- pig latin

(function () {
  const t = loadTool('pig-latin');
  t.set('english', 'pig apple string quick yellow rhythm square');
  ok(t.byId('pig').value === 'igpay appleway ingstray ickquay ellowyay ythmrhay aresquay',
     'the consonant, vowel, qu and y rules all apply',
     'got ' + t.byId('pig').value);

  t.set('english', 'Hello, World! NASA');
  ok(t.byId('pig').value === 'Ellohay, Orldway! ASANAY',
     'capitals and punctuation stay where they were', 'got ' + t.byId('pig').value);

  // reversing without hyphens is a guess, but the common cases come back
  t.set('pig', 'Ethay ickquay ownbray oxfay umpsjay overway ethay azylay ogday ingstray');
  ok(t.byId('english').value === 'The quick brown fox jumps over the lazy dog string',
     'Pig Latin turns back into the original English', 'got ' + t.byId('english').value);
  has(t.text('note'), 'best guess', 'and says it is a guess');

  // with hyphens and -way, a w-word and a vowel word look alike: say so
  t.set('hyphen', '-');
  t.set('english', 'weird thee eat');
  const hy = t.byId('pig').value;
  ok(hy === 'eird-way ee-thay eat-way', 'the hyphen style joins with a dash', 'got ' + hy);
  t.set('pig', hy);
  has(t.text('note'), 'best guess', 'eird-way is flagged as ambiguous');

  // with hyphens and the plain -ay ending it is exact
  t.set('ending', 'ay');
  t.set('english', 'weird thee eat');
  const exact = t.byId('pig').value;
  ok(exact === 'eird-way ee-thay eat-ay', 'the -ay ending keeps them apart', 'got ' + exact);
  t.set('pig', exact);
  ok(t.byId('english').value === 'weird thee eat', 'and reverses exactly',
     'got ' + t.byId('english').value);
  ok(t.text('note') === '', 'with no guess warning');
  t.close();
})();

// ---------------------------------------------------------------- alcohol strength

(function () {
  const t = loadTool('alcohol-abv');
  t.set('abv', '40');
  ok(t.byId('us').value === '80', '40% ABV is 80 US proof', 'got ' + t.byId('us').value);
  ok(t.byId('uk').value === '69.99', 'and 69.99 British proof', 'got ' + t.byId('uk').value);

  t.set('uk', '100');
  ok(t.byId('abv').value === '57.15', '100 British proof is 57.15% ABV', 'got ' + t.byId('abv').value);
  t.set('us', '100');
  ok(t.byId('abv').value === '50', '100 US proof is 50% ABV');

  // 330 ml of 5% beer: 16.5 ml pure, 13.0 g, 1.3 standard drinks
  t.set('abv', '5');
  t.set('vol', '330');
  ok(t.text('s-ml') === '16.5', 'pure alcohol in a small beer', 'got ' + t.text('s-ml'));
  ok(t.text('s-g') === '13', 'its weight in grams', 'got ' + t.text('s-g'));
  ok(t.text('s-std') === '1.3', 'and standard drinks', 'got ' + t.text('s-std'));
  t.set('count', '2');
  ok(t.text('s-ml') === '33', 'two of them doubles it', 'got ' + t.text('s-ml'));

  // 60 ml of 40% plus 180 ml mixer is 10%
  t.set('m-abv', '40');
  t.set('m-vol', '60');
  t.set('m-mixer', '180');
  has(t.text('mix'), '10% ABV', 'mixing works out the final strength');
  has(t.text('mix'), '240 ml', 'and the volume in the glass');
  t.close();
})();

// ---------------------------------------------------------------- tip calculator

(function () {
  const t = loadTool('tip-calculator');
  t.set('bill', '1000');
  t.set('people', '4');
  t.set('pct', '10');
  has(t.text('s-tip'), '100.00', '10% of 1,000 is 100');
  has(t.text('s-total'), '1,100.00', 'the total adds it on');
  has(t.text('s-each'), '275.00', 'and splits it four ways');

  // rounding each share up puts the extra into the tip
  t.set('people', '3');
  t.set('round', '50');
  has(t.text('s-each'), '400.00', '366.67 each rounds up to 400');
  has(t.text('s-total'), '1,200.00', 'so 1,200 in total');
  has(t.text('s-tip'), '200.00', 'and the tip absorbs the difference');
  has(t.text('s-eff'), '20', 'the real tip is shown as 20%');

  // a service charge already in the total: the tip is on the food only
  t.set('round', '0');
  t.set('people', '1');
  t.set('bill', '1100');
  t.set('service', true);
  t.set('service-pct', '10');
  ok(!t.byId('service-row').hidden, 'the service charge settings appear');
  has(t.text('verdict'), '1,000.00', 'food is worked back out of the total');
  has(t.text('s-tip'), '100.00', 'the tip is on the food, not on top of the charge');
  has(t.text('verdict'), '20% on top', 'and staff get 20% in all');

  ok(t.byId('table').querySelectorAll('tr').length === 8, 'the quick table lists eight tip levels');
  t.set('bill', '-5');
  has(t.text('verdict'), 'zero or more', 'a minus bill is refused');
  t.close();
})();

// ---------------------------------------------------------------- number to words

(function () {
  const t = loadTool('number-to-words');
  t.set('mode', 'cheque');
  t.set('system', 'lk');
  t.set('case', 'title');
  t.set('num', '1,25,750.50');
  ok(t.byId('out').value ===
     'Rupees One Lakh Twenty-Five Thousand Seven Hundred and Fifty and Cents Fifty Only',
     'a cheque amount in lakhs with cents', 'got ' + t.byId('out').value);

  t.set('case', 'lower');
  t.set('mode', 'plain');
  t.set('num', '25000000');
  ok(t.byId('out').value === 'two crore fifty lakh', '2,50,00,000 is two crore fifty lakh',
     'got ' + t.byId('out').value);
  t.set('system', 'intl');
  ok(t.byId('out').value === 'twenty-five million', 'and twenty-five million elsewhere',
     'got ' + t.byId('out').value);

  t.set('num', '1005');
  ok(t.byId('out').value === 'one thousand and five', 'British "and" after the thousands',
     'got ' + t.byId('out').value);
  t.set('and', false);
  t.set('num', '115');
  ok(t.byId('out').value === 'one hundred fifteen', 'the "and" can be turned off',
     'got ' + t.byId('out').value);
  t.set('and', true);

  // BigInt keeps 18-digit numbers exact
  t.set('num', '999999999999999999');
  has(t.byId('out').value, 'nine hundred and ninety-nine quadrillion', 'the biggest number works');
  ok(/ninety-nine$/.test(t.byId('out').value), 'and ends exactly, with no rounding',
     'got ' + t.byId('out').value);
  t.set('num', '1000000000000000000');
  has(t.text('note'), 'Too big', 'nineteen digits is refused');

  t.set('system', 'lk');
  t.set('num', '10000000000');
  ok(t.byId('out').value === 'one thousand crore', 'above 99 crore counts in crores',
     'got ' + t.byId('out').value);

  t.set('num', '-3.14');
  ok(t.byId('out').value === 'minus three point one four',
     'decimals are read digit by digit', 'got ' + t.byId('out').value);

  t.set('mode', 'ordinal');
  [['1', 'first'], ['22', 'twenty-second'], ['40', 'fortieth'],
   ['112', 'one hundred and twelfth']].forEach(([n, w]) => {
    t.set('num', n);
    ok(t.byId('out').value === w, n + ' as an ordinal is ' + w, 'got ' + t.byId('out').value);
  });

  t.set('mode', 'cheque');
  t.set('num', '0.999');
  ok(t.byId('out').value === 'rupees one only', 'cents round up into a whole rupee',
     'got ' + t.byId('out').value);
  t.set('num', 'Rs. 500');
  ok(t.byId('out').value === 'rupees five hundred only', 'a typed Rs. prefix is ignored',
     'got ' + t.byId('out').value);
  t.set('num', 'abc');
  has(t.text('note'), 'not a number', 'nonsense is refused');
  t.close();
})();

// ---------------------------------------------------------------- image helpers
// The pixel work is tested in a real browser by test/images.js; these are
// the sizes and names, which need to be exactly right.

(function () {
  const t = loadTool('image-resize');
  const IMG = t.window.CJA_IMG;
  ok(!!IMG, 'the image helper loads on image pages');

  const f = IMG.fit(4000, 3000, 1600, 1600);
  ok(f.width === 1600 && f.height === 1200, 'fit: 4000x3000 into 1600 is 1600x1200', JSON.stringify(f));
  const tall = IMG.fit(1000, 3000, 1600, 1600);
  ok(tall.width === 533 && tall.height === 1600, 'fit: a tall picture is limited by its height', JSON.stringify(tall));
  const no = IMG.fit(800, 600, 1600, 1600);
  ok(no.width === 800 && no.height === 600, 'fit: never enlarges unless asked');
  const yes = IMG.fit(800, 600, 1600, 1600, true);
  ok(yes.width === 1600 && yes.height === 1200, 'fit: enlarges when asked');
  const one = IMG.fit(800, 600, 400, 0);
  ok(one.width === 400 && one.height === 300, 'fit: a missing limit means no limit on that side');
  const tiny = IMG.fit(5000, 2, 100, 100);
  ok(tiny.height === 1, 'fit: never rounds a side down to zero');

  const c = IMG.clampRect({ x: -50, y: 10, width: 9999, height: 20 }, 800, 600);
  ok(c.x === 0 && c.width === 800 && c.y === 10 && c.height === 20, 'clampRect pulls a box back inside',
     JSON.stringify(c));
  const c2 = IMG.clampRect({ x: 790, y: 590, width: 50, height: 50 }, 800, 600);
  ok(c2.width === 10 && c2.height === 10, 'clampRect trims at the far edges', JSON.stringify(c2));

  const sq = IMG.ratioRect(2400, 1600, 1);
  ok(sq.width === 1600 && sq.height === 1600 && sq.x === 400 && sq.y === 0,
     'ratioRect: the biggest centred square', JSON.stringify(sq));
  const wide = IMG.ratioRect(1000, 1000, 16 / 9);
  ok(wide.width === 1000 && wide.height === 563 && wide.y === 219, 'ratioRect: 16:9 in a square',
     JSON.stringify(wide));

  ok(IMG.rename('holiday.photo.JPEG', 'png') === 'holiday.photo.png', 'rename swaps only the last extension');
  ok(IMG.rename('scan', 'jpg', '-small') === 'scan-small.jpg', 'rename adds a suffix to a name with no extension');
  ok(IMG.rename('', 'png') === 'image.png', 'rename gives a name when there is none');

  ok(IMG.bytes(512) === '512 bytes', 'bytes: under 1 KB');
  ok(IMG.bytes(1536) === '1.5 KB', 'bytes: KB with one decimal');
  ok(IMG.bytes(204800) === '200 KB', 'bytes: whole KB when large');
  ok(IMG.bytes(5 * 1024 * 1024) === '5.00 MB', 'bytes: MB');
  ok(IMG.escape('<b>&"') === '&lt;b&gt;&amp;&quot;', 'file names are escaped before going on the page');
  t.close();
})();

(function () {
  // every image page has a drop zone, a hidden file input and loads the helper
  ['image-compress', 'image-convert', 'image-resize', 'image-crop', 'round-corners',
   'image-border', 'add-text-to-image', 'image-watermark', 'pixelate-blur',
   'rotate-flip', 'photo-filters', 'image-color-picker', 'passport-photo'].forEach((slug) => {
    const t = loadTool(slug);
    ok(t.byId('drop') && t.byId('file') && t.byId('file').type === 'file',
       slug + ' has a drop zone and file input');
    ok(t.byId('file').getAttribute('accept') === 'image/*', slug + ' asks only for pictures');
    ok(!!t.window.CJA_IMG, slug + ' loads the image helper');
    t.close();
  });
})();

// ---------------------------------------------------------------- favicon generator
// The icon files are checked byte by byte in a real browser (test/images.js).

(function () {
  const t = loadTool('favicon-generator');
  ok(t.byId('snippet').value.indexOf('<link rel="icon" href="/favicon.ico"') === 0,
     'favicon: gives the HTML to paste');
  ok(t.byId('snippet').value.indexOf('manifest') === -1,
     'favicon: does not point at a manifest file it does not make');
  ok(!!t.window.CJA_IMG && t.byId('file').getAttribute('accept') === 'image/*',
     'favicon: can take a picture');
  t.set('from', 'picture');
  ok(!t.$('[data-from="picture"]').hidden && t.$('[data-from="letter"]').hidden,
     'favicon: switching to a picture shows the picture chooser');
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
