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
  },
  {
    slug: 'debt-payoff',
    name: 'Debt Payoff Planner',
    category: 'money',
    desc: 'Clear several debts in the order that saves the most, or the order that keeps you going.',
    keywords: ['debt', 'payoff', 'snowball', 'avalanche', 'loan', 'clear', 'plan']
  },
  {
    slug: 'credit-card-payoff',
    name: 'Credit Card Payoff',
    category: 'money',
    desc: 'How long the minimum payment really takes, and what paying more saves.',
    keywords: ['credit card', 'minimum payment', 'interest', 'payoff', 'debt']
  },
  {
    slug: 'car-loan',
    name: 'Car Loan Calculator',
    category: 'money',
    desc: 'Monthly instalment on a vehicle, with the deposit and the real total cost.',
    keywords: ['car', 'vehicle', 'loan', 'lease', 'instalment', 'auto', 'bike']
  },
  {
    slug: 'fuel-cost',
    name: 'Fuel Cost Calculator',
    category: 'money',
    desc: 'What a trip costs in fuel, and what your driving costs per month.',
    keywords: ['fuel', 'petrol', 'diesel', 'mileage', 'trip', 'cost', 'car']
  },
  {
    slug: 'paycheck',
    name: 'Payslip Calculator',
    category: 'money',
    desc: 'Build a full payslip from basic, allowances and overtime down to net pay.',
    keywords: ['payslip', 'paycheck', 'salary', 'net pay', 'deductions', 'overtime', 'epf']
  },
  {
    slug: 'net-worth',
    name: 'Net Worth Tracker',
    category: 'money',
    desc: 'Add up what you own against what you owe, and keep it on this device.',
    keywords: ['net worth', 'assets', 'liabilities', 'wealth', 'balance', 'track']
  },
  {
    slug: 'budget-planner',
    name: 'Budget Planner',
    category: 'money',
    desc: 'Where your money goes each month, and whether it adds up.',
    keywords: ['budget', 'planner', 'expenses', 'spending', 'monthly', 'income', '50 30 20']
  },
  {
    slug: 'emergency-fund',
    name: 'Emergency Fund',
    category: 'money',
    desc: 'How much you should keep aside, and how long it would last.',
    keywords: ['emergency', 'fund', 'savings', 'buffer', 'rainy day', 'months']
  },
  {
    slug: 'rent-vs-buy',
    name: 'Rent or Buy',
    category: 'money',
    desc: 'Compare renting against buying the same home over the years you would stay.',
    keywords: ['rent', 'buy', 'house', 'property', 'compare', 'mortgage', 'decision']
  },
  {
    slug: 'bookkeeping',
    name: 'Simple Bookkeeping',
    category: 'money',
    desc: 'A small cash book for income and expenses, saved on this device.',
    keywords: ['bookkeeping', 'ledger', 'accounts', 'income', 'expenses', 'business', 'cash book']
  },
  {
    slug: 'hash-generator',
    name: 'Hash Generator',
    category: 'security',
    desc: 'SHA hashes of text or a file, worked out on your own device.',
    keywords: ['hash', 'sha256', 'sha1', 'checksum', 'fingerprint', 'verify', 'digest']
  },
  {
    slug: 'text-encryption',
    name: 'Text Encryption',
    category: 'security',
    desc: 'Lock a message with a passphrase so only someone with it can read it.',
    keywords: ['encrypt', 'decrypt', 'password', 'secret', 'aes', 'cipher', 'private']
  },
  {
    slug: 'key-generator',
    name: 'Secure Key Generator',
    category: 'security',
    desc: 'Random API keys, tokens and secrets of any length, made on your device.',
    keywords: ['key', 'secret', 'token', 'api key', 'random', 'hex', 'base64']
  },
  {
    slug: 'encrypted-notes',
    name: 'Encrypted Notes',
    category: 'security',
    desc: 'Private notes locked behind a passphrase and kept only on this device.',
    keywords: ['encrypted', 'notes', 'private', 'secret', 'password', 'diary', 'vault']
  },
  {
    slug: 'metadata-remover',
    name: 'Photo Metadata Remover',
    category: 'security',
    desc: 'Strip the location and camera details hidden inside a photo before you share it.',
    keywords: ['metadata', 'exif', 'gps', 'location', 'photo', 'privacy', 'strip']
  },
  {
    slug: 'base64',
    name: 'Base64 Encoder',
    category: 'developers',
    desc: 'Encode and decode Base64, including files and data URLs.',
    keywords: ['base64', 'encode', 'decode', 'data url', 'binary', 'atob', 'btoa']
  },
  {
    slug: 'uuid-generator',
    name: 'UUID Generator',
    category: 'developers',
    desc: 'Generate v4 or time-ordered v7 UUIDs in bulk, in any format you need.',
    keywords: ['uuid', 'guid', 'unique', 'identifier', 'v4', 'v7', 'random']
  },
  {
    slug: 'jwt-decoder',
    name: 'JWT Decoder',
    category: 'developers',
    desc: 'Read what is inside a token, including when it expires.',
    keywords: ['jwt', 'token', 'json web token', 'decode', 'bearer', 'auth', 'claims']
  },
  {
    slug: 'url-encoder',
    name: 'URL Encoder',
    category: 'developers',
    desc: 'Encode and decode URLs, and pull a messy query string apart.',
    keywords: ['url', 'encode', 'decode', 'percent', 'query string', 'uri', 'escape']
  },
  {
    slug: 'cron-builder',
    name: 'Cron Expression Builder',
    category: 'developers',
    desc: 'Build a schedule in plain words and see the next times it runs.',
    keywords: ['cron', 'crontab', 'schedule', 'job', 'timer', 'expression', 'recurring']
  },
  {
    slug: 'regex-tester',
    name: 'Regex Tester',
    category: 'developers',
    desc: 'Test a pattern against your text and see every match and group as you type.',
    keywords: ['regex', 'regular expression', 'pattern', 'match', 'test', 'capture']
  },
  {
    slug: 'color-converter',
    name: 'Colour Converter',
    category: 'developers',
    desc: 'Convert between hex, RGB, HSL and named colours, with a contrast check.',
    keywords: ['colour', 'color', 'hex', 'rgb', 'hsl', 'contrast', 'palette', 'css']
  },
  {
    slug: 'json-to-typescript',
    name: 'JSON to TypeScript',
    category: 'developers',
    desc: 'Turn a JSON sample into TypeScript interfaces you can paste into code.',
    keywords: ['json', 'typescript', 'interface', 'types', 'convert', 'schema', 'dto']
  },
  {
    slug: 'minify-beautify',
    name: 'Minify and Beautify',
    category: 'developers',
    desc: 'Shrink or tidy up CSS, JSON and HTML, and see how much you saved.',
    keywords: ['minify', 'beautify', 'format', 'css', 'html', 'compress', 'pretty']
  },
  {
    slug: 'jsonl-viewer',
    name: 'JSONL Viewer',
    category: 'developers',
    desc: 'Read and check a JSON Lines file line by line, and find the broken one.',
    keywords: ['jsonl', 'ndjson', 'json lines', 'log', 'validate', 'dataset', 'view']
  },
  {
    slug: 'token-counter',
    name: 'Token Counter',
    category: 'developers',
    desc: 'Estimate how many tokens a prompt is and what it would cost to run.',
    keywords: ['token', 'count', 'cost', 'llm', 'prompt', 'estimate', 'context window']
  },
  {
    slug: 'diff-checker',
    name: 'Diff Checker',
    category: 'developers',
    desc: 'Compare two versions side by side and see what changed within each line.',
    keywords: ['diff', 'compare', 'changes', 'code', 'merge', 'review', 'version']
  },
  {
    slug: 'timestamp-converter',
    name: 'Timestamp Converter',
    category: 'developers',
    desc: 'Convert a Unix timestamp to a real date and back, in any time zone.',
    keywords: ['timestamp', 'unix', 'epoch', 'date', 'iso', 'milliseconds', 'convert']
  },
  {
    slug: 'json-schema-builder',
    name: 'JSON Schema Builder',
    category: 'developers',
    desc: 'Build a JSON Schema from a sample, then validate other data against it.',
    keywords: ['json schema', 'validate', 'schema', 'draft', 'contract', 'api']
  },
  {
    slug: 'curl-converter',
    name: 'cURL Converter',
    category: 'developers',
    desc: 'Turn a cURL command into fetch, axios, Python or Go code.',
    keywords: ['curl', 'fetch', 'axios', 'python', 'requests', 'http', 'convert']
  },
  {
    slug: 'prompt-cleaner',
    name: 'Prompt Cleaner',
    category: 'developers',
    desc: 'Strip smart quotes, invisible characters and stray formatting out of a prompt.',
    keywords: ['prompt', 'clean', 'smart quotes', 'invisible', 'llm', 'paste', 'tidy']
  },
  {
    slug: 'rag-chunker',
    name: 'Text Chunker',
    category: 'developers',
    desc: 'Split a long document into overlapping chunks for search or embedding.',
    keywords: ['rag', 'chunk', 'split', 'embedding', 'overlap', 'retrieval', 'document']
  },
  {
    slug: 'vector-similarity',
    name: 'Vector Similarity',
    category: 'developers',
    desc: 'Compare two embeddings with cosine similarity, dot product and distance.',
    keywords: ['vector', 'embedding', 'cosine', 'similarity', 'distance', 'dot product']
  },
  {
    slug: 'chat-transcript',
    name: 'Chat Transcript Converter',
    category: 'developers',
    desc: 'Move a conversation between plain text, a messages array and Markdown.',
    keywords: ['chat', 'transcript', 'messages', 'convert', 'llm', 'json', 'markdown']
  },
  {
    slug: 'meta-tags',
    name: 'Meta Tag Generator',
    category: 'seo',
    desc: 'Build the title, description and social sharing tags for a page, with a preview.',
    keywords: ['meta', 'open graph', 'og', 'twitter card', 'seo', 'tags', 'share']
  },
  {
    slug: 'robots-txt',
    name: 'Robots.txt Generator',
    category: 'seo',
    desc: 'Build a robots.txt that says what crawlers may and may not visit.',
    keywords: ['robots', 'robots.txt', 'crawler', 'seo', 'disallow', 'sitemap', 'bot']
  },
  {
    slug: 'sitemap-generator',
    name: 'Sitemap Generator',
    category: 'seo',
    desc: 'Build a sitemap.xml from a list of your pages, ready to submit.',
    keywords: ['sitemap', 'xml', 'seo', 'google', 'index', 'crawl', 'submit']
  },
  {
    slug: 'keyword-density',
    name: 'Keyword Density',
    category: 'seo',
    desc: 'See which words and phrases a page actually repeats, and how often.',
    keywords: ['keyword', 'density', 'seo', 'content', 'phrase', 'repeat', 'analyse']
  },
  {
    slug: 'social-preview',
    name: 'Social Card Preview',
    category: 'seo',
    desc: 'See how a link will look when shared on each major platform.',
    keywords: ['social', 'preview', 'card', 'share', 'facebook', 'twitter', 'whatsapp']
  },
  {
    slug: 'typing-test',
    name: 'Typing Speed Test',
    category: 'games',
    desc: 'Find your words per minute and accuracy, with your best score kept.',
    keywords: ['typing', 'test', 'wpm', 'speed', 'keyboard', 'accuracy', 'practice']
  },
  {
    slug: 'box-generator',
    name: 'Box Generator',
    category: 'printing',
    desc: 'Make a cutting template for a box that folds together, sized to fit.',
    keywords: ['box', 'laser', 'cut', 'svg', 'template', 'craft', 'packaging']
  },
  {
    slug: 'pomodoro',
    name: 'Focus Timer',
    category: 'time',
    desc: 'Work in set stretches with breaks between, and see what you got through.',
    keywords: ['pomodoro', 'focus', 'timer', 'work', 'break', 'concentrate', 'study']
  },
  {
    slug: 'alarm-clock',
    name: 'Alarm Clock',
    category: 'time',
    desc: 'Set alarms that ring on this device, with a clock you can read across a room.',
    keywords: ['alarm', 'clock', 'wake', 'remind', 'time', 'ring', 'nap']
  },
  {
    slug: 'todo-list',
    name: 'To-do List',
    category: 'time',
    desc: 'A plain checklist that saves itself, with due dates if you want them.',
    keywords: ['todo', 'to-do', 'list', 'task', 'checklist', 'done', 'plan']
  },
  {
    slug: 'habit-tracker',
    name: 'Habit Tracker',
    category: 'time',
    desc: 'Tick off a habit each day and watch the streak build up.',
    keywords: ['habit', 'tracker', 'streak', 'daily', 'routine', 'goal', 'consistency']
  },
  {
    slug: 'birthday-reminder',
    name: 'Birthday Reminder',
    category: 'time',
    desc: 'Keep birthdays in one place and see who is next, with ages.',
    keywords: ['birthday', 'reminder', 'anniversary', 'age', 'date', 'family', 'friends']
  },
  {
    slug: 'document-expiry',
    name: 'Document Expiry Tracker',
    category: 'time',
    desc: 'Keep passports, licences and insurance in one place and get warned before they lapse.',
    keywords: ['expiry', 'passport', 'licence', 'insurance', 'renew', 'document', 'visa']
  },
  {
    slug: 'vehicle-reminder',
    name: 'Vehicle Reminders',
    category: 'time',
    desc: 'Service, insurance, revenue licence and emission test, all in one place.',
    keywords: ['vehicle', 'car', 'service', 'insurance', 'revenue licence', 'emission', 'mot']
  },
  {
    slug: 'interval-timer',
    name: 'Interval Timer',
    category: 'time',
    desc: 'Work and rest rounds counted out loud for exercise or practice.',
    keywords: ['interval', 'timer', 'hiit', 'workout', 'rounds', 'tabata', 'exercise']
  },
  {
    slug: 'meeting-planner',
    name: 'Meeting Planner',
    category: 'time',
    desc: 'Find an hour that is reasonable for everybody, wherever they are.',
    keywords: ['meeting', 'planner', 'timezone', 'schedule', 'call', 'across', 'overlap']
  },
  {
    slug: 'event-countdown',
    name: 'Event Countdown',
    category: 'time',
    desc: 'Count down to the dates that matter, all on one page.',
    keywords: ['countdown', 'event', 'days until', 'deadline', 'date', 'wedding', 'exam']
  },
  {
    slug: 'barcode-generator',
    name: 'Barcode Generator',
    category: 'generators',
    desc: 'Make a retail barcode from a product number, with the check digit worked out.',
    keywords: ['barcode', 'ean', 'ean13', 'upc', 'product', 'retail', 'scan']
  },
  {
    slug: 'random-number',
    name: 'Random Numbers and Dice',
    category: 'generators',
    desc: 'Roll dice or pick numbers in a range, with or without repeats.',
    keywords: ['random', 'number', 'dice', 'roll', 'pick', 'lottery', 'd20']
  },
  {
    slug: 'wheel-spinner',
    name: 'Wheel Spinner',
    category: 'generators',
    desc: 'Put your options on a wheel and let it decide.',
    keywords: ['wheel', 'spinner', 'random', 'pick', 'decide', 'raffle', 'choose']
  },
  {
    slug: 'username-generator',
    name: 'Username Generator',
    category: 'generators',
    desc: 'Invent usernames and handles that are easy to say and remember.',
    keywords: ['username', 'handle', 'nickname', 'name', 'generate', 'gamertag', 'login']
  },
  {
    slug: 'fake-data',
    name: 'Test Data Generator',
    category: 'generators',
    desc: 'Make rows of believable fake people and orders for testing.',
    keywords: ['fake', 'test data', 'sample', 'mock', 'seed', 'csv', 'json', 'dummy']
  },
  {
    slug: 'coin-flip',
    name: 'Coin Flip',
    category: 'generators',
    desc: 'Flip one coin or a hundred, and see how the tally settles.',
    keywords: ['coin', 'flip', 'toss', 'heads', 'tails', 'random', 'decide']
  },
  {
    slug: 'business-name',
    name: 'Business Name Ideas',
    category: 'generators',
    desc: 'Generate name ideas for a shop or venture, with the domain to check.',
    keywords: ['business', 'name', 'brand', 'company', 'shop', 'startup', 'idea']
  },
  {
    slug: 'team-picker',
    name: 'Team Picker',
    category: 'generators',
    desc: 'Split a list of names into fair teams, or draw one at random.',
    keywords: ['team', 'picker', 'random', 'groups', 'split', 'draw', 'shuffle']
  },
  {
    slug: 'qr-scanner',
    name: 'QR Code Scanner',
    category: 'generators',
    desc: 'Read a QR code from your camera or an image, on your own device.',
    keywords: ['qr', 'scanner', 'read', 'camera', 'decode', 'scan', 'barcode']
  },
  {
    slug: 'morse-code',
    name: 'Morse Code Translator',
    category: 'world',
    desc: 'Translate to and from Morse, and hear it beeped out.',
    keywords: ['morse', 'code', 'translate', 'sos', 'beep', 'dots', 'dashes']
  },
  {
    slug: 'nato-alphabet',
    name: 'NATO Phonetic Alphabet',
    category: 'world',
    desc: 'Spell anything out the way it is read over a phone or radio.',
    keywords: ['nato', 'phonetic', 'alphabet', 'spell', 'alpha bravo', 'radio', 'callsign']
  },
  {
    slug: 'braille',
    name: 'Braille Translator',
    category: 'world',
    desc: 'Text to Unified English Braille and back, letter by letter.',
    keywords: ['braille', 'blind', 'dots', 'ueb', 'translate', 'accessibility']
  },
  {
    slug: 'pig-latin',
    name: 'Pig Latin Translator',
    category: 'world',
    desc: 'Move the first sounds to the end and add "ay". Works both ways.',
    keywords: ['pig latin', 'igpay', 'secret language', 'word game', 'translate']
  },
  {
    slug: 'alcohol-abv',
    name: 'Alcohol Strength Converter',
    category: 'world',
    desc: 'ABV, US proof and British proof, plus pure alcohol in a drink or a mix.',
    keywords: ['abv', 'proof', 'alcohol', 'units', 'standard drink', 'arrack', 'beer', 'wine']
  },
  {
    slug: 'tip-calculator',
    name: 'Tip Calculator',
    category: 'world',
    desc: 'The tip, the total and what each person pays, with service charge checked.',
    keywords: ['tip', 'gratuity', 'service charge', 'restaurant', 'split', 'bill']
  },
  {
    slug: 'number-to-words',
    name: 'Number to Words',
    category: 'world',
    desc: 'Write any amount out in words, in lakhs and crores or millions. Cheque mode.',
    keywords: ['number to words', 'cheque', 'check', 'amount in words', 'lakh', 'crore', 'spell number']
  },
  {
    slug: 'image-compress',
    name: 'Compress Image',
    category: 'image',
    desc: 'Make a photo smaller in file size, or squeeze it under a limit like 200 KB.',
    keywords: ['compress', 'reduce', 'smaller', 'kb', 'file size', 'jpg', 'photo', 'shrink']
  },
  {
    slug: 'image-convert',
    name: 'Convert Image',
    category: 'image',
    desc: 'Turn a picture into JPG, PNG or WebP.',
    keywords: ['convert', 'jpg', 'png', 'webp', 'gif', 'bmp', 'format', 'image']
  },
  {
    slug: 'image-resize',
    name: 'Resize Image',
    category: 'image',
    desc: 'Change the width and height in pixels or by percentage.',
    keywords: ['resize', 'scale', 'pixels', 'width', 'height', 'smaller', 'bigger', 'photo']
  },
  {
    slug: 'image-crop',
    name: 'Crop Image',
    category: 'image',
    desc: 'Cut a picture down to the part you want, freely or to a set shape.',
    keywords: ['crop', 'cut', 'trim', 'square', '16:9', 'passport', 'photo']
  },
  {
    slug: 'round-corners',
    name: 'Round Corners',
    category: 'image',
    desc: 'Rounded corners, or a circle for a profile picture.',
    keywords: ['round', 'corners', 'circle', 'profile picture', 'rounded', 'avatar']
  },
  {
    slug: 'image-border',
    name: 'Add a Border',
    category: 'image',
    desc: 'A plain, double or photo-print frame around a picture.',
    keywords: ['border', 'frame', 'polaroid', 'edge', 'outline', 'photo']
  },
  {
    slug: 'add-text-to-image',
    name: 'Add Text to Image',
    category: 'image',
    desc: 'Write a caption or message on a picture and drag it into place.',
    keywords: ['text', 'caption', 'write on photo', 'meme', 'words', 'label', 'sinhala']
  },
  {
    slug: 'image-watermark',
    name: 'Watermark Image',
    category: 'image',
    desc: 'Your name or logo on a picture, in a corner or repeated across it.',
    keywords: ['watermark', 'copyright', 'logo', 'protect', 'stamp', 'brand']
  },
  {
    slug: 'favicon-generator',
    name: 'Favicon Generator',
    category: 'image',
    desc: 'A website tab icon (favicon.ico and PNG sizes) from a picture or a letter.',
    keywords: ['favicon', 'ico', 'icon', 'website', 'apple touch icon', 'tab icon']
  },
  {
    slug: 'pixelate-blur',
    name: 'Pixelate or Blur',
    category: 'image',
    desc: 'Hide faces, number plates or ID numbers in a picture.',
    keywords: ['pixelate', 'blur', 'hide', 'censor', 'redact', 'face', 'number plate', 'nic']
  },
  {
    slug: 'rotate-flip',
    name: 'Rotate and Flip',
    category: 'image',
    desc: 'Turn a sideways photo the right way up, mirror it, or straighten it.',
    keywords: ['rotate', 'flip', 'mirror', 'turn', 'straighten', 'sideways', 'upside down']
  },
  {
    slug: 'photo-filters',
    name: 'Photo Filters',
    category: 'image',
    desc: 'Brightness, contrast, colour, black and white, sepia and ready-made looks.',
    keywords: ['filter', 'brightness', 'contrast', 'black and white', 'grayscale', 'sepia', 'saturation', 'edit photo']
  },
  {
    slug: 'image-color-picker',
    name: 'Colour Picker from Image',
    category: 'image',
    desc: 'Click a picture to get the exact colour code, and see its main colours.',
    keywords: ['color picker', 'colour picker', 'eyedropper', 'hex', 'palette', 'rgb', 'extract colours']
  },
  {
    slug: 'passport-photo',
    name: 'Passport Photo Maker',
    category: 'image',
    desc: 'Frame a photo at passport size and print copies on a 4x6 or A4 sheet.',
    keywords: ['passport photo', 'visa photo', 'id photo', '35x45', '2x2', 'print sheet', 'nic photo']
  },
  {
    slug: 'meme-maker',
    name: 'Meme Maker',
    category: 'image',
    desc: 'Bold top and bottom text, or a caption above, on any picture.',
    keywords: ['meme', 'caption', 'impact font', 'funny', 'top text', 'bottom text']
  },
  {
    slug: 'photo-collage',
    name: 'Photo Collage',
    category: 'image',
    desc: 'Two to nine photos in one picture, with spacing and rounded corners.',
    keywords: ['collage', 'combine photos', 'grid', 'photo layout', 'merge images', 'side by side']
  },
  {
    slug: 'image-splitter',
    name: 'Image Splitter',
    category: 'image',
    desc: 'Cut a picture into a grid of pieces, for an Instagram grid or a panorama.',
    keywords: ['split', 'grid', 'instagram grid', 'panorama', 'slice', 'tiles', 'carousel']
  },
  {
    slug: 'image-to-ascii',
    name: 'Image to ASCII Art',
    category: 'image',
    desc: 'A picture drawn with letters and symbols, to copy or save.',
    keywords: ['ascii', 'text art', 'characters', 'convert', 'retro']
  },
  {
    slug: 'remove-background',
    name: 'Remove Background',
    category: 'image',
    desc: 'Make a plain background see-through or a new colour: signatures, logos, products.',
    keywords: ['remove background', 'transparent', 'signature', 'white background', 'png', 'cut out', 'logo']
  },
  {
    slug: 'svg-to-png',
    name: 'SVG to PNG',
    category: 'image',
    desc: 'A sharp PNG, JPG or WebP of an SVG logo or icon, at any size.',
    keywords: ['svg', 'png', 'convert', 'vector', 'logo', 'icon', 'rasterize']
  },
  {
    slug: 'image-compare',
    name: 'Image Compare',
    category: 'image',
    desc: 'Two pictures with a sliding divider, side by side, or every change in red.',
    keywords: ['compare', 'before after', 'difference', 'spot the difference', 'slider', 'diff']
  },
  {
    slug: 'screenshot-beautifier',
    name: 'Screenshot Beautifier',
    category: 'image',
    desc: 'A screenshot on a smart background with a window frame and shadow.',
    keywords: ['screenshot', 'mockup', 'window frame', 'background', 'shadow', 'social post', 'slide']
  },
  {
    slug: 'merge-pdf',
    name: 'Merge PDF',
    category: 'pdf',
    desc: 'Join several PDFs, and pictures, into one PDF in the order you choose.',
    keywords: ['merge', 'combine', 'join', 'pdf', 'append', 'add pages']
  },
  {
    slug: 'split-pdf',
    name: 'Split PDF',
    category: 'pdf',
    desc: 'Take pages out of a PDF, or cut it into several PDFs.',
    keywords: ['split', 'extract pages', 'separate', 'pdf', 'cut', 'page range']
  },
  {
    slug: 'images-to-pdf',
    name: 'Images to PDF',
    category: 'pdf',
    desc: 'Photos and pictures into one PDF, a page each, upright and on A4.',
    keywords: ['jpg to pdf', 'image to pdf', 'photo to pdf', 'png to pdf', 'scan', 'receipt', 'convert']
  },
  {
    slug: 'pdf-to-images',
    name: 'PDF to Images',
    category: 'pdf',
    desc: 'Each PDF page as a JPG or PNG picture, at screen or print quality.',
    keywords: ['pdf to jpg', 'pdf to png', 'pdf to image', 'convert', 'pages', 'picture']
  },
  {
    slug: 'rotate-pdf',
    name: 'Rotate PDF',
    category: 'pdf',
    desc: 'Turn sideways or upside-down pages the right way and save.',
    keywords: ['rotate', 'turn', 'sideways', 'upside down', 'pdf', 'landscape', 'portrait']
  },
  {
    slug: 'remove-pages',
    name: 'Remove Pages',
    category: 'pdf',
    desc: 'Delete blank, extra or private pages from a PDF.',
    keywords: ['delete pages', 'remove pages', 'blank pages', 'pdf', 'cut']
  },
  {
    slug: 'organize-pdf',
    name: 'Organise PDF',
    category: 'pdf',
    desc: 'Drag pages into a new order, turn or delete them, add blank pages.',
    keywords: ['organize', 'organise', 'reorder', 'rearrange', 'sort pages', 'move pages', 'pdf']
  },
  {
    slug: 'pdf-page-numbers',
    name: 'Add Page Numbers',
    category: 'pdf',
    desc: 'Number the pages of a PDF, with styles like Page 1 of 10.',
    keywords: ['page numbers', 'number pages', 'pagination', 'footer', 'pdf', 'bates']
  },
  {
    slug: 'watermark-pdf',
    name: 'Watermark PDF',
    category: 'pdf',
    desc: 'Stamp DRAFT, COPY, CONFIDENTIAL or a logo across the pages.',
    keywords: ['watermark', 'stamp', 'draft', 'confidential', 'copy', 'pdf', 'logo']
  },
  {
    slug: 'sign-pdf',
    name: 'Sign PDF',
    category: 'pdf',
    desc: 'Draw, type or upload your signature and place it on a PDF.',
    keywords: ['sign', 'signature', 'e-sign', 'fill form', 'initials', 'pdf']
  },
  {
    slug: 'pdf-to-text',
    name: 'PDF to Text',
    category: 'pdf',
    desc: 'Get the words out of a PDF to copy, edit or save as text.',
    keywords: ['pdf to text', 'extract text', 'copy text', 'pdf to txt', 'words', 'convert']
  },
  {
    slug: 'compress-pdf',
    name: 'Compress PDF',
    category: 'pdf',
    desc: 'Make a PDF smaller for email or an upload limit.',
    keywords: ['compress', 'reduce size', 'smaller', 'shrink', 'pdf', 'email', 'upload limit', 'mb']
  },
  {
    slug: 'pdf-metadata',
    name: 'PDF Properties',
    category: 'pdf',
    desc: 'See, change or wipe the hidden title, author and dates in a PDF.',
    keywords: ['metadata', 'properties', 'author', 'title', 'privacy', 'remove metadata', 'pdf']
  },
  {
    slug: 'crop-pdf',
    name: 'Crop PDF',
    category: 'pdf',
    desc: 'Trim the margins of PDF pages, by measurement or automatically.',
    keywords: ['crop', 'trim', 'margins', 'cut', 'pdf', 'white space']
  },
  {
    slug: 'fill-pdf-form',
    name: 'Fill PDF Form',
    category: 'pdf',
    desc: 'Type into the boxes of a fillable PDF form and save it.',
    keywords: ['fill form', 'pdf form', 'fillable', 'application form', 'acroform', 'checkbox', 'pdf']
  },
  {
    slug: 'add-text-to-pdf',
    name: 'Add Text to PDF',
    category: 'pdf',
    desc: 'Type on any PDF and tick boxes on printed forms, in English, Sinhala or Tamil.',
    keywords: ['add text', 'type on pdf', 'write on pdf', 'tick', 'annotate', 'sinhala', 'tamil', 'edit pdf']
  },
  {
    slug: 'audio-cutter',
    name: 'Audio Cutter',
    category: 'audio',
    desc: 'Keep just the part of a song or recording you want, or cut a part out.',
    keywords: ['cut', 'trim', 'mp3 cutter', 'ringtone', 'fade', 'audio', 'song']
  },
  {
    slug: 'voice-recorder',
    name: 'Voice Recorder',
    category: 'audio',
    desc: 'Record from the microphone, listen back and save.',
    keywords: ['record', 'voice', 'microphone', 'mic', 'dictaphone', 'audio', 'voice note']
  },
  {
    slug: 'audio-volume',
    name: 'Volume Changer',
    category: 'audio',
    desc: 'Make a recording louder or quieter, without crackling.',
    keywords: ['volume', 'louder', 'quieter', 'boost', 'normalize', 'gain', 'audio']
  },
  {
    slug: 'audio-joiner',
    name: 'Join Audio',
    category: 'audio',
    desc: 'Several clips into one file, with a gap or a crossfade.',
    keywords: ['join', 'merge', 'combine', 'mp3 joiner', 'crossfade', 'audio', 'songs']
  },
  {
    slug: 'audio-speed',
    name: 'Speed and Reverse',
    category: 'audio',
    desc: 'Speed up or slow down a recording, keeping the voice natural, or reverse it.',
    keywords: ['speed', 'slow down', 'faster', 'tempo', 'pitch', 'reverse', 'backwards', 'audio']
  },
  {
    slug: 'tone-generator',
    name: 'Tone Generator',
    category: 'audio',
    desc: 'A tone at any pitch, or a sweep, to test speakers, tune or check hearing.',
    keywords: ['tone', 'frequency', 'hz', 'sine wave', 'hearing test', 'speaker test', 'tuning']
  }
];

/* Works both as a plain script tag and under a bundler later. */
if (typeof window !== 'undefined') {
  window.CATEGORIES = CATEGORIES;
  window.TOOLS = TOOLS;
}
