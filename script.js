// Cifrado César y Atbash, pero sobre un alfabeto que arma el usuario
// (no nomás las 26 letras de siempre). La idea clave: todo se mueve
// por ÍNDICE dentro del arreglo del alfabeto, no por la letra en sí.
// Por eso funciona igual si metes ASCII completo, solo minúsculas,
// emojis, lo que sea.

// Tabla de frecuencia de letras en español (sacada de estadísticas
// típicas del idioma). Esto es la base del criptoanálisis: en
// cualquier texto largo en español, la 'e' y la 'a' van a aparecer
// muchísimo más que la 'k' o la 'w'. Si un texto NO se parece a esto,
// probablemente no está bien descifrado (o no es español).
const SPANISH_FREQ = {
  a:12.53, b:1.42, c:4.68, d:5.86, e:13.68, f:0.69, g:1.01, h:0.70,
  i:6.25, j:0.44, k:0.01, l:4.97, m:3.15, n:6.71, ñ:0.31, o:8.68,
  p:2.51, q:0.88, r:6.87, s:7.98, t:4.63, u:3.93, v:0.90, w:0.02,
  x:0.22, y:0.90, z:0.52
};

// Con textos muy cortos el chi-cuadrado se vuelve una mentira: puede
// que 3 letras le "atinen" de pura suerte a las frecuencias esperadas
// y parezca mejor candidato que el correcto. Por eso ponemos un piso:
// si no hay al menos estas letras contadas, ni se toma en serio ese
// candidato.
const MIN_LETRAS_MUESTRA = 15;

// Caracteres invisibles que la gente a veces mete para "esconder" cosas
// al copiar y pegar (espacio de ancho cero, marcas raras de dirección
// de texto, BOM). No se ven pero para JS SÍ cuentan como caracteres,
// así que hay que quitarlos antes de analizar nada.
const INVISIBLES_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

// Alfabeto por default: los 95 caracteres imprimibles de ASCII
// (del espacio al 126). Con esto arranca la página si no se toca nada.
function buildAsciiPrintable(){
  let arr = [];
  for (let code = 32; code <= 126; code++){
    arr.push(String.fromCharCode(code));
  }
  return arr.join('');
}

// Lee lo que el usuario haya puesto en el textarea de alfabeto y le
// quita los caracteres repetidos (si metió la misma letra dos veces
// se queda solo con la primera aparición). El ORDEN en que quedan
// importa un montón, porque ese orden es el que usan César y Atbash
// para calcular índices.
function getAlphabetArray(){
  const raw = document.getElementById('alphabet').value;
  const seen = new Set();
  const out = [];
  for (const ch of raw){
    if (!seen.has(ch)){ seen.add(ch); out.push(ch); }
  }
  return out;
}

// Antes de intentar descifrar algo, solo hay que quitar los invisibles
// de arriba (zero-width, BOM, marcas de dirección RTL/LTR): esos sí son
// ruido real que nadie mete a propósito y que arruinaría el conteo de
// frecuencias si se cuela.
//
// OJO: aquí ya NO se borran los caracteres que no estén en el alfabeto
// (espacios, puntuación, etc.). Antes se hacía, pero eso era un bug:
// al cifrar, esos caracteres se dejan intactos en el texto cifrado
// (caesarTransform/atbashTransform los copian tal cual), así que si al
// descifrar los borrábamos de golpe, el resultado perdía justo esos
// caracteres —típicamente los espacios— en vez de conservarlos. Ahora
// se dejan pasar tal cual hacia caesarTransform/atbashTransform, que ya
// saben copiarlos sin tocarlos, exactamente como pasa al cifrar. Para
// el análisis de frecuencias no hace falta quitarlos antes: chiSquaredSpanish
// ya solo cuenta los caracteres que están en SPANISH_FREQ.
function limpiarRuido(texto){
  return texto.replace(INVISIBLES_REGEX, '');
}

// mod normal de JS a veces regresa negativos (ej. -1 % 5 = -1), y eso
// nos rompería el índice del arreglo. Esto lo arregla para que siempre
// caiga en el rango 0..m-1.
function mod(n, m){ return ((n % m) + m) % m; }

// El César de toda la vida, pero en vez de sumarle al código de la
// letra le sumamos a su POSICIÓN dentro del alfabeto que sea. Los
// caracteres que no estén en el alfabeto se quedan igualitos (por si
// hay espacios o signos que el usuario no metió a propósito).
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

// Atbash: le das la vuelta al alfabeto (el primero se cambia por el
// último, el segundo por el penúltimo...). Como aplicarlo dos veces te
// regresa al texto original, la misma función sirve para cifrar y
// para descifrar, no hay que hacer una versión "inversa" aparte.
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

// Aquí es donde de verdad se rompe el cifrado. Contamos cuántas veces
// sale cada letra española en el texto y lo comparamos contra lo que
// "debería" salir según SPANISH_FREQ. Entre más se parezca, más bajo
// el chi-cuadrado, y más probable que ESE sea el texto descifrado
// correcto (es básicamente lo que hacía al-Kindi a mano, nomás que
// aquí lo hace la computadora en un parpadeo).
function chiSquaredSpanish(text){
  const counts = {};
  let total = 0;
  for (const ch of text.toLowerCase()){
    if (SPANISH_FREQ.hasOwnProperty(ch)){
      counts[ch] = (counts[ch] || 0) + 1;
      total++;
    }
  }
  // Si no hay suficientes letras para confiar en el resultado, ni le
  // seguimos: lo mandamos directo a Infinity para que quede descartado.
  if (total < MIN_LETRAS_MUESTRA) return Infinity;
  let chi2 = 0;
  for (const letra in SPANISH_FREQ){
    const expected = (SPANISH_FREQ[letra] / 100) * total;
    const observed = counts[letra] || 0;
    chi2 += Math.pow(observed - expected, 2) / expected;
  }
  // Se divide entre el total de letras para que un texto cortito y uno
  // largote sean comparables entre sí (si no, el chi-cuadrado crudo
  // castiga más a los textos largos nomás por tener más letras).
  return chi2 / total;
}

// Aquí pasa la magia de "el usuario no elige nada". Probamos TODAS las
// formas posibles de que haya salido ese texto cifrado (Atbash + cada
// desplazamiento de César que se pueda con este alfabeto) y nos
// quedamos con la que mejor se parezca al español. Ni una sola vez le
// preguntamos al usuario "¿cuál de estas crees que es?".
function autoDecrypt(cipherTextCrudo, alphabet){
  // primero, fuera los invisibles (espacios y demás se quedan intactos)
  const cipherText = limpiarRuido(cipherTextCrudo);

  const n = alphabet.length;
  const candidates = [];

  // el candidato Atbash siempre es uno solo, no tiene "desplazamientos"
  candidates.push({
    method: 'Atbash',
    detail: '',
    text: atbashTransform(cipherText, alphabet),
    score: null
  });

  // y aquí probamos TODOS los desplazamientos posibles de César,
  // como fuerza bruta pero tantito más inteligente porque luego
  // calificamos cada intento en vez de enseñarlos todos
  for (let k = 1; k < n; k++){
    const text = caesarTransform(cipherText, alphabet, -k);
    candidates.push({
      method: 'César',
      detail: `desplazamiento k=${k}`,
      text,
      score: null
    });
  }

  // calificamos a todos y ordenamos del más creíble al menos creíble
  for (const c of candidates){ c.score = chiSquaredSpanish(c.text); }
  candidates.sort((a,b) => a.score - b.score);

  const best = candidates[0];
  // si hasta el mejor de todos quedó en Infinity, es que el texto
  // estaba muy cortito para confiar en nada — mejor avisar que
  // inventarnos una respuesta que ni sabemos si es correcta
  best.confiable = best.score !== Infinity;

  return best;
}

// interface

// al cargar la página, dejamos listo el ASCII de default en el textarea
document.getElementById('alphabet').value = buildAsciiPrintable();

// botón para regresar al ASCII de default si el usuario ya lo cambió
document.getElementById('resetAlphabet').addEventListener('click', () => {
  document.getElementById('alphabet').value = buildAsciiPrintable();
});

// las pestañitas de Cifrar / Descifrar, nomás mostrar y esconder paneles
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('panel-cifrar').style.display = target === 'cifrar' ? 'block' : 'none';
    document.getElementById('panel-descifrar').style.display = target === 'descifrar' ? 'block' : 'none';
  });
});

// botón de Cifrar: aquí SÍ el usuario elige el método (César o Atbash)
document.getElementById('btnCifrar').addEventListener('click', () => {
  const alphabet = getAlphabetArray();
  if (alphabet.length === 0){
    alert('El alfabeto no puede estar vacío.');
    return;
  }

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

// botón de Descifrar: aquí YA NO se pregunta nada, entra directo a
// autoDecrypt() y se muestra nomás el resultado ganador
document.getElementById('btnDescifrar').addEventListener('click', () => {
  const alphabet = getAlphabetArray();
  if (alphabet.length === 0){
    alert('El alfabeto no puede estar vacío.');
    return;
  }

  const text = document.getElementById('cipher').value;
  const best = autoDecrypt(text, alphabet);
  document.getElementById('outDescifrar').textContent = best.text || ' ';

  if (!best.confiable){
    // aquí es honesto el sistema: si no le alcanzó texto para estar
    // seguro, lo dice en vez de aparentar que sí sabe
    document.getElementById('metaDescifrar').innerHTML =
      `<b>⚠ Texto demasiado corto para detección confiable</b> ` +
      `(se necesitan al menos ${MIN_LETRAS_MUESTRA} letras del alfabeto español para el análisis de frecuencias). ` +
      `El resultado mostrado es solo el candidato "menos malo", no una detección real.`;
  } else {
    document.getElementById('metaDescifrar').innerHTML =
      `<b>Método detectado:</b> ${best.method} ${best.detail} — <b>χ² reducido =</b> ${best.score.toFixed(4)}`;
  }
});