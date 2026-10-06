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

// ---------------------------------------------------------------- report

(async function report() {
  for (const t of pending) await t();
  console.log('');
  failures.forEach(f => console.log('FAIL  ' + f));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
