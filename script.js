/* =========================================================================
   CIFRADO CÉSAR / ATBASH SOBRE ALFABETO PARAMETRIZABLE
   -------------------------------------------------------------------------
   1. ALFABETO
      Arreglo ordenado de caracteres (por defecto, los 95 imprimibles de
      ASCII 32-126). La posición de cada carácter en ese arreglo es lo que
      César y Atbash desplazan/invierten.

   2. CÉSAR
      cifrado(c)    = alfabeto[ (indice(c) + k) mod n ]
      descifrado(c) = alfabeto[ (indice(c) - k) mod n ]

   3. ATBASH (involutivo: cifrar == descifrar)
      atbash(c) = alfabeto[ n - 1 - indice(c) ]

   4. LIMPIEZA DE RUIDO ANTES DE DESCIFRAR
      A diferencia de simplemente "saltar" los caracteres que no están en
      el alfabeto (dejarlos parados en medio del texto), aquí se ELIMINAN
      por completo antes de correr el análisis. Esto es a propósito:
      si alguien mete caracteres decorativos que no pertenecen al alfabeto
      de trabajo (otros alfabetos, emoji, símbolos), no deben aparecer en
      el resultado ni contaminar el análisis de frecuencias. También se
      eliminan caracteres invisibles típicos (marcas de dirección de
      texto RTL/LTR, espacio de ancho cero, BOM) que ni siquiera se ven
      al copiar/pegar pero sí cuentan como "caracteres" para JavaScript.

   5. CRIPTOANÁLISIS AUTOMÁTICO (aporte de Al-Kindi)
      Al descifrar, el sistema no pregunta el método. Genera todos los
      candidatos posibles (1 candidato Atbash + (n-1) candidatos César)
      y los califica con una prueba de bondad de ajuste chi-cuadrada
      contra las frecuencias de letras del español. El candidato con
      menor chi-cuadrado es el único que se muestra: el usuario nunca
      elige, el sistema decide.
   ========================================================================= */

// --- Frecuencias relativas de letras en español (%)
const SPANISH_FREQ = {
  a:12.53, b:1.42, c:4.68, d:5.86, e:13.68, f:0.69, g:1.01, h:0.70,
  i:6.25, j:0.44, k:0.01, l:4.97, m:3.15, n:6.71, ñ:0.31, o:8.68,
  p:2.51, q:0.88, r:6.87, s:7.98, t:4.63, u:3.93, v:0.90, w:0.02,
  x:0.22, y:0.90, z:0.52
};

// Caracteres invisibles conocidos que se usan para "esconder" ruido sin
// que se vea al copiar/pegar: espacio de ancho cero, marcas de dirección
// de texto (usadas por árabe/hebreo), BOM, joiners.
const INVISIBLES_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

function buildAsciiPrintable(){
  let arr = [];
  for (let code = 32; code <= 126; code++){
    arr.push(String.fromCharCode(code));
  }
  return arr.join('');
}

function getAlphabetArray(){
  const raw = document.getElementById('alphabet').value;
  const seen = new Set();
  const out = [];
  for (const ch of raw){
    if (!seen.has(ch)){ seen.add(ch); out.push(ch); }
  }
  return out;
}

// Quita invisibles y, después, cualquier carácter que no esté en el
// alfabeto activo. No los "salta": los borra, para que el ruido
// desaparezca del texto en vez de quedarse incrustado en el resultado.
function limpiarRuido(texto, alphabet){
  const sinInvisibles = texto.replace(INVISIBLES_REGEX, '');
  const permitidos = new Set(alphabet);
  let limpio = '';
  for (const ch of sinInvisibles){
    if (permitidos.has(ch)){
      limpio += ch;
    }
  }
  return limpio;
}

function mod(n, m){ return ((n % m) + m) % m; }

function caesarTransform(text, alphabet, shift){
  const n = alphabet.length;
  const index = new Map(alphabet.map((c,i)=>[c,i]));
  let out = '';
  for (const ch of text){
    if (index.has(ch)){
      const i = index.get(ch);
      out += alphabet[mod(i + shift, n)];
    } else {
      out += ch;
    }
  }
  return out;
}

function atbashTransform(text, alphabet){
  const n = alphabet.length;
  const index = new Map(alphabet.map((c,i)=>[c,i]));
  let out = '';
  for (const ch of text){
    if (index.has(ch)){
      const i = index.get(ch);
      out += alphabet[n - 1 - i];
    } else {
      out += ch;
    }
  }
  return out;
}

// Chi-cuadrada de bondad de ajuste contra el español.
function chiSquaredSpanish(text){
  const counts = {};
  let total = 0;
  for (const ch of text.toLowerCase()){
    if (SPANISH_FREQ.hasOwnProperty(ch)){
      counts[ch] = (counts[ch] || 0) + 1;
      total++;
    }
  }
  if (total === 0) return Infinity;
  let chi2 = 0;
  for (const letra in SPANISH_FREQ){
    const expected = (SPANISH_FREQ[letra] / 100) * total;
    const observed = counts[letra] || 0;
    chi2 += Math.pow(observed - expected, 2) / expected;
  }
  return chi2;
}

function autoDecrypt(cipherTextCrudo, alphabet){
  // Paso 1: eliminar ruido (invisibles + cualquier cosa fuera del alfabeto)
  const cipherText = limpiarRuido(cipherTextCrudo, alphabet);

  const n = alphabet.length;
  const candidates = [];

  candidates.push({
    method: 'Atbash',
    detail: '',
    text: atbashTransform(cipherText, alphabet),
    score: null
  });

  for (let k = 1; k < n; k++){
    const text = caesarTransform(cipherText, alphabet, -k);
    candidates.push({
      method: 'César',
      detail: `desplazamiento k=${k}`,
      text,
      score: null
    });
  }

  for (const c of candidates){ c.score = chiSquaredSpanish(c.text); }
  candidates.sort((a,b) => a.score - b.score);

  return candidates[0];
}

// ---------------- UI wiring ----------------

document.getElementById('alphabet').value = buildAsciiPrintable();

document.getElementById('resetAlphabet').addEventListener('click', () => {
  document.getElementById('alphabet').value = buildAsciiPrintable();
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('panel-cifrar').style.display = target === 'cifrar' ? 'block' : 'none';
    document.getElementById('panel-descifrar').style.display = target === 'descifrar' ? 'block' : 'none';
  });
});

function updateShiftCount(){
  const n = getAlphabetArray().length;
  document.getElementById('nShifts').textContent = Math.max(n - 1, 0);
}
document.getElementById('alphabet').addEventListener('input', updateShiftCount);
updateShiftCount();

document.getElementById('btnCifrar').addEventListener('click', () => {
  const alphabet = getAlphabetArray();
  const text = document.getElementById('plain').value;
  const metodo = document.querySelector('input[name=metodoC]:checked').value;
  let result;
  if (metodo === 'atbash'){
    result = atbashTransform(text, alphabet);
  } else {
    const k = parseInt(document.getElementById('shiftC').value, 10) || 0;
    result = caesarTransform(text, alphabet, k);
  }
  document.getElementById('outCifrar').textContent = result || ' ';
});

document.getElementById('btnDescifrar').addEventListener('click', () => {
  const alphabet = getAlphabetArray();
  const text = document.getElementById('cipher').value;
  const best = autoDecrypt(text, alphabet);
  document.getElementById('outDescifrar').textContent = best.text || ' ';
  document.getElementById('metaDescifrar').innerHTML =
    `<b>Método detectado:</b> ${best.method} ${best.detail} — <b>χ² =</b> ${best.score.toFixed(2)}`;
});
