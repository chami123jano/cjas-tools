/* Passphrase encryption, shared by the text encryption tool and the
   encrypted notes tool. One implementation, because two copies of crypto
   code is how one of them quietly ends up weaker than the other.

   Format of an encrypted blob, before base64:
     magic "CJA1"  4 bytes   so a wrong paste can be rejected with a clear
                             message instead of a decryption failure
     salt         16 bytes   fresh per encryption, for the key derivation
     iv           12 bytes   fresh per encryption, required by AES-GCM
     ciphertext   the rest   AES-GCM, which also authenticates the data

   AES-GCM detects tampering, so a wrong passphrase or an edited blob fails
   loudly rather than returning plausible rubbish. */

var CJA_CRYPTO = (function () {
  var MAGIC = [0x43, 0x4A, 0x41, 0x31];   /* "CJA1" */
  var SALT_LEN = 16;
  var IV_LEN = 12;

  /* High enough to make guessing a weak passphrase slow, low enough that a
     phone does not hang. OWASP suggests at least 210,000 for PBKDF2-SHA256. */
  var ITERATIONS = 250000;

  function available() {
    return typeof crypto !== 'undefined' && crypto.subtle &&
           crypto.subtle.importKey && crypto.getRandomValues;
  }

  function toBase64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function fromBase64(text) {
    var clean = text.replace(/\s+/g, '');
    var raw = atob(clean);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function deriveKey(passphrase, salt) {
    return crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    ).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: ITERATIONS, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });
  }

  return {
    iterations: ITERATIONS,
    available: available,

    encrypt: function (plaintext, passphrase) {
      if (!available()) return Promise.reject(new Error('unsupported'));
      if (!passphrase) return Promise.reject(new Error('no-passphrase'));

      var salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
      var iv = crypto.getRandomValues(new Uint8Array(IV_LEN));

      return deriveKey(passphrase, salt).then(function (key) {
        return crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          new TextEncoder().encode(plaintext)
        );
      }).then(function (cipher) {
        var body = new Uint8Array(cipher);
        var out = new Uint8Array(MAGIC.length + SALT_LEN + IV_LEN + body.length);
        out.set(MAGIC, 0);
        out.set(salt, MAGIC.length);
        out.set(iv, MAGIC.length + SALT_LEN);
        out.set(body, MAGIC.length + SALT_LEN + IV_LEN);
        return toBase64(out);
      });
    },

    decrypt: function (blob, passphrase) {
      if (!available()) return Promise.reject(new Error('unsupported'));
      if (!passphrase) return Promise.reject(new Error('no-passphrase'));

      var bytes;
      try {
        bytes = fromBase64(blob);
      } catch (e) {
        return Promise.reject(new Error('not-a-blob'));
      }

      if (bytes.length < MAGIC.length + SALT_LEN + IV_LEN + 1) {
        return Promise.reject(new Error('not-a-blob'));
      }
      for (var i = 0; i < MAGIC.length; i++) {
        if (bytes[i] !== MAGIC[i]) return Promise.reject(new Error('not-a-blob'));
      }

      var salt = bytes.slice(MAGIC.length, MAGIC.length + SALT_LEN);
      var iv = bytes.slice(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN);
      var body = bytes.slice(MAGIC.length + SALT_LEN + IV_LEN);

      return deriveKey(passphrase, salt).then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, body);
      }).then(function (plain) {
        return new TextDecoder().decode(plain);
      }).catch(function () {
        /* AES-GCM fails the same way for a wrong passphrase and for edited
           data, and it cannot tell them apart. Saying so is honest. */
        return Promise.reject(new Error('wrong-passphrase'));
      });
    },

    /* A rough guide, not a promise. Length matters far more than symbols. */
    strength: function (passphrase) {
      if (!passphrase) return { label: '—', note: 'Enter a passphrase' };
      var pool = 0;
      if (/[a-z]/.test(passphrase)) pool += 26;
      if (/[A-Z]/.test(passphrase)) pool += 26;
      if (/[0-9]/.test(passphrase)) pool += 10;
      if (/[^a-zA-Z0-9]/.test(passphrase)) pool += 32;
      var bits = passphrase.length * Math.log2(pool || 1);

      if (bits < 40) return { label: 'Weak', note: 'Easy to guess. Use more words.', bits: bits };
      if (bits < 60) return { label: 'Reasonable', note: 'Fine for something ordinary.', bits: bits };
      if (bits < 80) return { label: 'Strong', note: 'Good for anything private.', bits: bits };
      return { label: 'Very strong', note: 'Suitable for anything.', bits: bits };
    }
  };
})();

if (typeof window !== 'undefined') window.CJA_CRYPTO = CJA_CRYPTO;
