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
  }
];

/* Works both as a plain script tag and under a bundler later. */
if (typeof window !== 'undefined') {
  window.CATEGORIES = CATEGORIES;
  window.TOOLS = TOOLS;
}
