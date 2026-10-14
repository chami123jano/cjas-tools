/* The single source of truth for what exists in the app.
   Adding a tool = add a row here + create the page in tools/.
   `planned` is the eventual count per category, used for the progress numbers. */

const CATEGORIES = [
  { id: 'pdf',         name: 'PDF',         icon: '📄', planned: 16 },
  { id: 'image',       name: 'Image',       icon: '🖼️', planned: 22 },
  { id: 'video',       name: 'Video',       icon: '🎬', planned: 13 },
  { id: 'audio',       name: 'Audio',       icon: '🎵', planned: 9  },
  { id: 'text',        name: 'Text',        icon: '📝', planned: 13 },
  { id: 'converters',  name: 'Converters',  icon: '🔄', planned: 6  },
  { id: 'calculators', name: 'Calculators', icon: '🧮', planned: 11 },
  { id: 'money',       name: 'Money',       icon: '💰', planned: 15 },
  { id: 'developers',  name: 'Developers',  icon: '⚙️', planned: 20 },
  { id: 'seo',         name: 'SEO',         icon: '🔍', planned: 5  },
  { id: 'security',    name: 'Security',    icon: '🔒', planned: 6  },
  { id: 'time',        name: 'Time',        icon: '⏱️', planned: 10 },
  { id: 'generators',  name: 'Generators',  icon: '✨', planned: 10 },
  { id: 'world',       name: 'World',       icon: '🌍', planned: 7  },
  { id: 'srilanka',    name: 'Sri Lanka',   icon: '🇱🇰', planned: 6  },
  { id: 'games',       name: 'Games',       icon: '🎮', planned: 1  },
  { id: 'printing',    name: '3D Printing', icon: '🧊', planned: 1  }
];

const TOOLS = [
  {
    slug: 'percentage-calculator',
    name: 'Percentage Calculator',
    category: 'calculators',
    desc: 'Work out percentages, increases, decreases and discounts.',
    keywords: ['percent', '%', 'increase', 'decrease', 'discount', 'change']
  },
  {
    slug: 'word-counter',
    name: 'Word Counter',
    category: 'text',
    desc: 'Count words, characters, sentences and reading time as you type.',
    keywords: ['word', 'count', 'character', 'letters', 'essay', 'reading time']
  },
  {
    slug: 'case-converter',
    name: 'Case Converter',
    category: 'text',
    desc: 'Change text to UPPERCASE, lowercase, Title Case, camelCase and more.',
    keywords: ['case', 'uppercase', 'lowercase', 'title', 'camel', 'snake', 'kebab']
  },
  {
    slug: 'unit-converter',
    name: 'Unit Converter',
    category: 'converters',
    desc: 'Length, weight, temperature, area, volume and speed.',
    keywords: ['unit', 'convert', 'metre', 'kg', 'celsius', 'mile', 'litre', 'measurement']
  },
  {
    slug: 'password-generator',
    name: 'Password Generator',
    category: 'security',
    desc: 'Strong random passwords, made on your device and never sent anywhere.',
    keywords: ['password', 'random', 'secure', 'strong', 'passphrase', 'generate']
  },
  {
    slug: 'qr-code-generator',
    name: 'QR Code Generator',
    category: 'generators',
    desc: 'Turn a link, text, phone number or wifi login into a QR code.',
    keywords: ['qr', 'code', 'barcode', 'scan', 'link', 'wifi', 'download']
  },
  {
    slug: 'json-formatter',
    name: 'JSON Formatter',
    category: 'developers',
    desc: 'Tidy up, shrink and check JSON, with the exact spot of any error.',
    keywords: ['json', 'format', 'beautify', 'pretty', 'minify', 'validate', 'parse']
  },
  {
    slug: 'paye-tax-calculator',
    name: 'PAYE Tax Calculator',
    category: 'srilanka',
    desc: 'Sri Lankan APIT on your monthly salary, with EPF and ETF worked out too.',
    keywords: ['paye', 'apit', 'tax', 'salary', 'sri lanka', 'epf', 'etf', 'income']
  },
  {
    slug: 'bmi-calculator',
    name: 'BMI Calculator',
    category: 'calculators',
    desc: 'Body mass index from your height and weight, in metric or imperial.',
    keywords: ['bmi', 'body mass', 'weight', 'height', 'healthy', 'obese', 'index']
  },
  {
    slug: 'age-calculator',
    name: 'Age Calculator',
    category: 'calculators',
    desc: 'Your exact age in years, months and days, and how long until your birthday.',
    keywords: ['age', 'birthday', 'born', 'date of birth', 'how old', 'dob']
  },
  {
    slug: 'loan-calculator',
    name: 'Loan / EMI Calculator',
    category: 'calculators',
    desc: 'Monthly instalment, total interest and a full repayment breakdown.',
    keywords: ['loan', 'emi', 'instalment', 'interest', 'mortgage', 'repayment', 'borrow']
  },
  {
    slug: 'discount-calculator',
    name: 'Discount Calculator',
    category: 'calculators',
    desc: 'Sale price and what you save, or work backwards to the original price.',
    keywords: ['discount', 'sale', 'off', 'percent', 'price', 'saving', 'reduction']
  },
  {
    slug: 'bill-splitter',
    name: 'Bill Splitter',
    category: 'calculators',
    desc: 'Split a bill between people, with a tip and uneven shares if you need.',
    keywords: ['bill', 'split', 'share', 'tip', 'restaurant', 'per person', 'divide']
  },
  {
    slug: 'date-difference',
    name: 'Date Difference',
    category: 'calculators',
    desc: 'How long between two dates, or what the date will be after so many days.',
    keywords: ['date', 'difference', 'between', 'days', 'add', 'subtract', 'duration']
  },
  {
    slug: 'business-days',
    name: 'Business Days Calculator',
    category: 'calculators',
    desc: 'Working days between two dates, skipping weekends and any holidays you add.',
    keywords: ['business', 'working', 'days', 'weekday', 'holiday', 'deadline', 'office']
  },
  {
    slug: 'gpa-calculator',
    name: 'GPA Calculator',
    category: 'calculators',
    desc: 'Grade point average from your courses and credits, on a 4.0 or 4.3 scale.',
    keywords: ['gpa', 'grade point', 'average', 'university', 'credits', 'degree', 'cgpa']
  },
  {
    slug: 'grade-calculator',
    name: 'Grade Calculator',
    category: 'calculators',
    desc: 'Your weighted course grade, and what you still need in the final exam.',
    keywords: ['grade', 'mark', 'weighted', 'exam', 'assignment', 'percentage', 'final']
  },
  {
    slug: 'countdown-timer',
    name: 'Countdown & Stopwatch',
    category: 'calculators',
    desc: 'A countdown timer and a stopwatch with laps, accurate even in a background tab.',
    keywords: ['countdown', 'timer', 'stopwatch', 'lap', 'alarm', 'minutes', 'clock']
  },
  {
    slug: 'base-converter',
    name: 'Number Base Converter',
    category: 'converters',
    desc: 'Convert between binary, octal, decimal, hex and any base up to 36.',
    keywords: ['base', 'binary', 'hex', 'hexadecimal', 'octal', 'decimal', 'radix']
  },
  {
    slug: 'csv-json',
    name: 'CSV to JSON',
    category: 'converters',
    desc: 'Turn a spreadsheet export into JSON, or JSON back into CSV.',
    keywords: ['csv', 'json', 'convert', 'spreadsheet', 'excel', 'table', 'data']
  },
  {
    slug: 'currency-converter',
    name: 'Currency Converter',
    category: 'converters',
    desc: 'Live exchange rates for 160+ currencies, remembered for when you are offline.',
    keywords: ['currency', 'exchange', 'rate', 'dollar', 'rupee', 'lkr', 'usd', 'money']
  },
  {
    slug: 'metric-us-converter',
    name: 'Metric to US Converter',
    category: 'converters',
    desc: 'Quick everyday conversions for cooking, distance, weight and temperature.',
    keywords: ['metric', 'imperial', 'us', 'cooking', 'cup', 'ounce', 'fahrenheit', 'recipe']
  },
  {
    slug: 'timezone-converter',
    name: 'Time Zone Converter',
    category: 'converters',
    desc: 'What time it is somewhere else, and a good hour for a call.',
    keywords: ['timezone', 'time zone', 'utc', 'gmt', 'meeting', 'world clock', 'colombo']
  },
  {
    slug: 'poya-calendar',
    name: 'Poya Calendar',
    category: 'srilanka',
    desc: 'Every Poya day of the year, with the next one counted down.',
    keywords: ['poya', 'full moon', 'vesak', 'poson', 'esala', 'holiday', 'buddhist']
  },
  {
    slug: 'singlish-converter',
    name: 'Singlish to Sinhala',
    category: 'srilanka',
    desc: 'Type Sinhala using English letters and get proper Sinhala Unicode.',
    keywords: ['singlish', 'sinhala', 'unicode', 'transliterate', 'type', 'keyboard']
  },
  {
    slug: 'postal-codes',
    name: 'Sri Lanka Postal Codes',
    category: 'srilanka',
    desc: 'Look up a postal code by town, or find out which town a code belongs to.',
    keywords: ['postal', 'post', 'code', 'zip', 'postcode', 'address', 'colombo']
  },
  {
    slug: 'exchange-rates',
    name: 'Rupee Exchange Rates',
    category: 'srilanka',
    desc: 'What the rupee is worth against the currencies people here actually send.',
    keywords: ['exchange', 'rate', 'rupee', 'lkr', 'dollar', 'remittance', 'forex']
  },
  {
    slug: 'find-replace',
    name: 'Find and Replace',
    category: 'text',
    desc: 'Replace text across a whole document, with whole-word and pattern matching.',
    keywords: ['find', 'replace', 'search', 'substitute', 'regex', 'bulk', 'edit']
  },
  {
    slug: 'remove-duplicates',
    name: 'Remove Duplicate Lines',
    category: 'text',
    desc: 'Strip repeated lines from a list, or keep only the ones that repeat.',
    keywords: ['duplicate', 'unique', 'repeated', 'lines', 'dedupe', 'list', 'clean']
  },
  {
    slug: 'sort-lines',
    name: 'Sort Lines',
    category: 'text',
    desc: 'Sort a list alphabetically, by number, by length, or shuffle it.',
    keywords: ['sort', 'order', 'alphabetical', 'lines', 'list', 'reverse', 'shuffle']
  },
  {
    slug: 'remove-spaces',
    name: 'Remove Extra Spaces',
    category: 'text',
    desc: 'Tidy up double spaces, trailing spaces, blank lines and stray tabs.',
    keywords: ['space', 'whitespace', 'trim', 'blank', 'tidy', 'clean', 'tabs']
  },
  {
    slug: 'text-compare',
    name: 'Text Compare',
    category: 'text',
    desc: 'See line by line what changed between two versions of some text.',
    keywords: ['compare', 'diff', 'difference', 'changes', 'versions', 'merge']
  },
  {
    slug: 'markdown-to-html',
    name: 'Markdown to HTML',
    category: 'text',
    desc: 'Turn Markdown into clean HTML, with a live preview of how it looks.',
    keywords: ['markdown', 'html', 'convert', 'readme', 'preview', 'md', 'format']
  },
  {
    slug: 'notepad',
    name: 'Notepad',
    category: 'text',
    desc: 'A scratch pad that saves itself on this device as you type.',
    keywords: ['notepad', 'notes', 'scratch', 'write', 'draft', 'save', 'text']
  },
  {
    slug: 'emoji-search',
    name: 'Emoji Search',
    category: 'text',
    desc: 'Find an emoji by name or feeling and copy it with one click.',
    keywords: ['emoji', 'emoticon', 'smiley', 'symbol', 'search', 'copy', 'icon']
  },
  {
    slug: 'fancy-text',
    name: 'Fancy Text',
    category: 'text',
    desc: 'Turn plain words into bold, italic, script or bubble letters for bios.',
    keywords: ['fancy', 'font', 'unicode', 'bold', 'script', 'bio', 'stylish']
  },
  {
    slug: 'blackboard',
    name: 'Blackboard',
    category: 'text',
    desc: 'A chalkboard you can write and draw on, then save as a picture.',
    keywords: ['blackboard', 'chalkboard', 'draw', 'chalk', 'teach', 'sketch', 'whiteboard']
  },
  {
    slug: 'handwriting',
    name: 'Text to Handwriting',
    category: 'text',
    desc: 'Put your typed words onto ruled paper in a handwriting style.',
    keywords: ['handwriting', 'handwritten', 'paper', 'note', 'cursive', 'assignment']
  },
  {
    slug: 'nic-decoder',
    name: 'NIC Number Decoder',
    category: 'srilanka',
    desc: 'Read the date of birth, gender and age out of a Sri Lankan NIC number.',
    keywords: ['nic', 'id', 'identity card', 'birthday', 'age', 'gender', 'sri lanka']
  },
  {
    slug: 'compound-interest',
    name: 'Compound Interest',
    category: 'money',
    desc: 'What savings grow to over time, including money you add each month.',
    keywords: ['compound', 'interest', 'savings', 'invest', 'growth', 'fixed deposit']
  },
  {
    slug: 'mortgage-calculator',
    name: 'Mortgage Calculator',
    category: 'money',
    desc: 'Monthly payment on a house, with the deposit and the real total cost.',
    keywords: ['mortgage', 'housing loan', 'home', 'house', 'deposit', 'property']
  },
  {
    slug: 'savings-goal',
    name: 'Savings Goal',
    category: 'money',
    desc: 'How long until you reach a target, or what you need to put away monthly.',
    keywords: ['savings', 'goal', 'target', 'save', 'plan', 'monthly', 'deposit']
  },
  {
    slug: 'salary-converter',
    name: 'Salary Converter',
    category: 'money',
    desc: 'Switch a wage between hourly, daily, weekly, monthly and yearly.',
    keywords: ['salary', 'wage', 'hourly', 'annual', 'monthly', 'pay', 'rate']
  },
  {
    slug: 'inflation-calculator',
    name: 'Inflation Calculator',
    category: 'money',
    desc: 'What money from one year is worth in another, and what it buys now.',
    keywords: ['inflation', 'value', 'purchasing power', 'cost of living', 'rupee']
  }
];

/* Works both as a plain script tag and under a bundler later. */
if (typeof window !== 'undefined') {
  window.CATEGORIES = CATEGORIES;
  window.TOOLS = TOOLS;
}
