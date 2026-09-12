# Cifrado César / Atbash con criptoanálisis automático (Al-Kindi)

Aplicación web de un solo archivo (`index.html`, HTML+CSS+JS sin dependencias
ni backend) que cifra y descifra texto con los métodos **César** y **Atbash**
sobre un alfabeto configurable, y que **descifra sin intervención humana**:
el propio sistema determina qué método y qué desplazamiento se usó.

## 1. Cómo funciona el alfabeto

Todo el programa gira alrededor de un arreglo ordenado de caracteres
(`alphabet`), que por defecto son los 95 caracteres imprimibles del código
ASCII (códigos 32–126, generados con `String.fromCharCode`). El usuario
puede sustituir ese arreglo por cualquier conjunto de símbolos —estén o no
en ASCII (acentos, emoji, alfabetos no latinos, etc.)— siempre sin
caracteres repetidos.

La posición (índice) de un carácter dentro de ese arreglo es lo único que
usan los dos algoritmos. Un carácter del texto que **no** esté en el
alfabeto se copia tal cual al resultado; esto permite, por ejemplo, dejar
intactos espacios o signos de puntuación si el usuario no los incluyó
deliberadamente.

## 2. Cifrado César

```
cifrado(c)    = alfabeto[ (índice(c) + k) mod n ]
descifrado(c) = alfabeto[ (índice(c) - k) mod n ]
```

`k` es el desplazamiento (módulo) y `n` el tamaño del alfabeto activo. Al
cifrar, el usuario elige `k` libremente.

## 3. Cifrado Atbash

Atbash es una sustitución fija que invierte el alfabeto:

```
atbash(c) = alfabeto[ n - 1 - índice(c) ]
```

Es **involutivo**: aplicar la misma función dos veces regresa el texto
original, por lo que cifrar y descifrar usan exactamente la misma
operación.

## 4. Descifrado automático (el aporte de Al-Kindi)

El enunciado exige que el sistema identifique el módulo/tipo de cifrado
usado **sin que el humano intervenga en decidir cuál lectura es la
correcta**. Esto es, en esencia, lo que formalizó el matemático y filósofo
árabe **أبو يوسف يعقوب بن إسحاق الكندي (Al-Kindi, siglo IX)** en su
*Manuscrito sobre el descifrado de mensajes criptográficos*: el primer
texto conocido que describe el **análisis de frecuencias** como método
sistemático para romper cifrados por sustitución, en lugar de adivinar a
mano. Al-Kindi observó que, en un idioma natural, ciertas letras aparecen
con una frecuencia relativa característica y estable; un cifrado por
sustitución simple no cambia esa distribución, solo la "reetiqueta" —así
que comparar la distribución de un texto contra la distribución esperada
del idioma permite reconocer, de forma automática, cuál clave produce
lenguaje real.

Implementación:

1. Se genera **un candidato Atbash** (una sola opción posible, porque es
   involutivo) y **un candidato César por cada desplazamiento posible**
   (`k = 1 … n-1`, con `n` el tamaño del alfabeto).
2. Cada candidato se puntúa con una **prueba de bondad de ajuste
   chi-cuadrada (χ²)** contra la tabla de frecuencias de letras del
   español (`SPANISH_FREQ` en el código), considerando solo los
   caracteres alfabéticos del texto descifrado.
3. El candidato con **menor χ²** —es decir, cuya distribución de letras
   más se parece al español real— se presenta como resultado. Es el
   único candidato que se muestra: el sistema no expone las demás
   lecturas ni pide al usuario que elija entre ellas.

Esto cumple el requisito de la rúbrica: *"solo deberán mostrar la línea
descifrada correcta... NO debe intervenir el factor humano en el
descifrado del mensaje."*

### Limitación conocida (documentada a propósito)

El análisis de frecuencias asume que el texto plano es español (u otro
idioma con distribución de letras conocida) y de longitud suficiente.
Mensajes muy cortos, o alfabetos hechos de símbolos sin equivalente
lingüístico, pueden hacer que la puntuación χ² no discrimine bien. Esa es
precisamente la idea que se quiere transmitir en la introducción del
reporte: **por qué César y Atbash ya no sirven como protección real de
datos** — son vulnerables a un método de criptoanálisis de hace más de
mil años, automatizable en unas cuantas líneas de código.

## 5. Estructura del código (`index.html`)

- `buildAsciiPrintable()` — genera el alfabeto ASCII por defecto.
- `getAlphabetArray()` — lee y depura (sin duplicados) el alfabeto activo.
- `caesarTransform(text, alphabet, shift)` — cifra/descifra César (shift
  negativo = descifrar).
- `atbashTransform(text, alphabet)` — cifra/descifra Atbash.
- `chiSquaredSpanish(text)` — estadístico χ² de un texto contra las
  frecuencias del español.
- `autoDecrypt(cipherText, alphabet)` — genera todos los candidatos,
  los puntúa y regresa el mejor.
- El resto del archivo es cableado de interfaz (pestañas Cifrar/Descifrar,
  eventos de botones).

No hay backend ni almacenamiento: todo el cómputo ocurre en el navegador
del usuario, por lo que no se transmite ni persiste ningún texto.

## 6. Publicación

El sitio es estático (un solo `index.html`), así que se puede publicar
gratis con **GitHub Pages**:

1. Crear un repositorio público en GitHub y subir `index.html` (y este
   `README.md`).
2. Ir a *Settings → Pages*, elegir la rama `main` y la carpeta `/root`.
3. GitHub entrega una URL tipo
   `https://<usuario>.github.io/<repositorio>/` — esa es la liga al
   programa.
4. La liga al código documentado es la del propio repositorio de GitHub
   (que ya incluye este README con la documentación).

Alternativas igualmente válidas: Netlify Drop, Vercel, o subir el mismo
archivo como una página en Google Sites / Google Drive público.

## 7. Bibliografía sugerida para el reporte

- Al-Kindi, *Risāla fī Istikhrāj al-Muʿammā* ("Manuscrito sobre el
  descifrado de mensajes criptográficos"), s. IX.
- Kahn, D. (1996). *The Codebreakers: The Story of Secret Writing*.
  Scribner.
- Singh, S. (1999). *The Code Book*. Doubleday.
- Stallings, W. (2017). *Cryptography and Network Security*. Pearson.
