#!/usr/bin/env node
/**
 * probar-local.js — Corre las pruebas del simulador en Node con una hoja de cálculo SIMULADA.
 *
 * Uso (desde la raíz del repo):
 *   node herramientas/construir.js          # genera dist/SimuladorCompleto.gs
 *   node herramientas/probar-local.js       # ejecuta probarTodo contra una hoja simulada
 *
 * IMPORTANTE: esto NO reemplaza probar en Google Sheets real. La hoja simulada guarda valores y
 * rangos con nombre pero ignora formatos, colores y validaciones. Sirve para detectar rápido
 * errores de lógica y referencias rotas antes de pegar el código en la hoja real.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
const RUTA = process.argv[2] || path.join(RAIZ, 'dist', 'SimuladorCompleto.gs');
if (!fs.existsSync(RUTA)) {
  console.error('No existe ' + RUTA + '. Ejecuta primero: node herramientas/construir.js');
  process.exit(1);
}

// ── Utilidades A1 ────────────────────────────────────────────────────
function colANumero(letras) {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function numeroACol(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function parsearA1(a1) {
  const m = String(a1).replace(/\$/g, '').match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!m) throw new Error('A1 no soportado: ' + a1);
  const c1 = colANumero(m[1].toUpperCase()), f1 = Number(m[2]);
  const c2 = m[3] ? colANumero(m[3].toUpperCase()) : c1, f2 = m[4] ? Number(m[4]) : f1;
  return { fila: f1, col: c1, nFilas: f2 - f1 + 1, nCols: c2 - c1 + 1 };
}

// Objeto "permisivo": cualquier método desconocido (formato, bordes, validaciones...) no hace nada y devuelve el mismo objeto.
function conAutoReferencia(crear) {
  let proxy;
  const base = crear(() => proxy);
  proxy = new Proxy(base, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      return function () { return proxy; };
    }
  });
  return proxy;
}

// ── Hoja simulada ────────────────────────────────────────────────────
class Hoja {
  constructor(libro, nombre) { this.libro = libro; this.nombre = nombre; this.celdas = new Map(); this.fondos = new Map(); this.maxFila = 0; }
  clave(f, c) { return f + ',' + c; }
  leer(f, c) { const v = this.celdas.get(this.clave(f, c)); return v === undefined ? '' : v; }
  escribir(f, c, v) {
    if (v === '' || v === null || v === undefined) this.celdas.delete(this.clave(f, c));
    else { this.celdas.set(this.clave(f, c), v); if (f > this.maxFila) this.maxFila = f; }
  }
}

function crearRango(hoja, fila, col, nFilas, nCols) {
  const r = conAutoReferencia(self => ({
    getSheet: () => proxyHoja(hoja),
    getRow: () => fila, getColumn: () => col,
    getNumRows: () => nFilas, getNumColumns: () => nCols,
    getLastRow: () => fila + nFilas - 1, getLastColumn: () => col + nCols - 1,
    getA1Notation: () => numeroACol(col) + fila + ((nFilas > 1 || nCols > 1) ? ':' + numeroACol(col + nCols - 1) + (fila + nFilas - 1) : ''),
    getValue: () => hoja.leer(fila, col),
    getDisplayValue: () => String(hoja.leer(fila, col)),
    getValues: () => matriz((f, c) => hoja.leer(f, c)),
    getDisplayValues: () => matriz((f, c) => String(hoja.leer(f, c))),
    getFormula: () => '',
    setValue: v => { for (let f = 0; f < nFilas; f++) for (let c = 0; c < nCols; c++) hoja.escribir(fila + f, col + c, v); return self(); },
    setValues: vs => {
      if (vs.length !== nFilas || (vs[0] && vs[0].length !== nCols)) {
        throw new Error('setValues: dimensiones ' + vs.length + 'x' + (vs[0] ? vs[0].length : 0) + ' no coinciden con el rango ' + nFilas + 'x' + nCols);
      }
      vs.forEach((fila_, i) => fila_.forEach((v, j) => hoja.escribir(fila + i, col + j, v)));
      return self();
    },
    setFormula: () => self(),
    clearContent: () => { for (let f = 0; f < nFilas; f++) for (let c = 0; c < nCols; c++) hoja.escribir(fila + f, col + c, null); return self(); },
    clear: () => { for (let f = 0; f < nFilas; f++) for (let c = 0; c < nCols; c++) { hoja.escribir(fila + f, col + c, null); hoja.fondos.delete(hoja.clave(fila + f, col + c)); } return self(); },
    getCell: (i, j) => crearRango(hoja, fila + i - 1, col + j - 1, 1, 1),
    offset: (df, dc, nf, nc) => crearRango(hoja, fila + df, col + dc, nf || nFilas, nc || nCols),
    getBackground: () => hoja.fondos.get(hoja.clave(fila, col)) || '#ffffff',
    getBackgrounds: () => matriz((f, c) => hoja.fondos.get(hoja.clave(f, c)) || '#ffffff'),
    setBackground: color => { for (let f = 0; f < nFilas; f++) for (let c = 0; c < nCols; c++) { if (color) hoja.fondos.set(hoja.clave(fila + f, col + c), String(color).toLowerCase()); else hoja.fondos.delete(hoja.clave(fila + f, col + c)); } return self(); },
    setBackgrounds: m => { m.forEach((fl, i) => fl.forEach((color, j) => { if (color) hoja.fondos.set(hoja.clave(fila + i, col + j), String(color).toLowerCase()); else hoja.fondos.delete(hoja.clave(fila + i, col + j)); })); return self(); },
    isChecked: () => false
  }));
  function matriz(fn) {
    const m = [];
    for (let f = 0; f < nFilas; f++) { const fila_ = []; for (let c = 0; c < nCols; c++) fila_.push(fn(fila + f, col + c)); m.push(fila_); }
    return m;
  }
  return r;
}

const proxiesHoja = new Map();
function proxyHoja(hoja) {
  if (proxiesHoja.has(hoja)) return proxiesHoja.get(hoja);
  const p = conAutoReferencia(self => ({
    getName: () => hoja.nombre,
    getRange(a, b, c, d) {
      if (typeof a === 'string') { const p_ = parsearA1(a); return crearRango(hoja, p_.fila, p_.col, p_.nFilas, p_.nCols); }
      return crearRango(hoja, a, b, c || 1, d || 1);
    },
    getLastRow: () => hoja.maxFila,
    getParent: () => hoja.libro.proxy,
    getSheetId: () => 1,
    getMaxRows: () => 1000, getMaxColumns: () => 26
  }));
  proxiesHoja.set(hoja, p);
  return p;
}

// ── Libro simulado ───────────────────────────────────────────────────
class Libro {
  constructor() {
    this.hojas = new Map(); this.nombrados = new Map(); this.avisos = [];
    this.proxy = conAutoReferencia(self => ({
      getSheetByName: n => this.hojas.has(n) ? proxyHoja(this.hojas.get(n)) : null,
      insertSheet: n => { const h = new Hoja(this, n); this.hojas.set(n, h); return proxyHoja(h); },
      getSheets: () => [...this.hojas.values()].map(proxyHoja),
      deleteSheet: sh => { this.hojas.delete(sh.getName()); },
      setNamedRange: (n, rango) => { this.nombrados.set(n, rango); },
      getRangeByName: n => this.nombrados.get(n) || null,
      getNamedRanges: () => [...this.nombrados.keys()].map(n => ({ remove: () => this.nombrados.delete(n) })),
      toast: (m, t) => { this.avisos.push(String(t || '') + ': ' + m); },
      getId: () => 'simulado'
    }));
  }
}
const libro = new Libro();

const propiedades = new Map();
const consola = [];

const sandbox = {
  console, Date, Math, JSON, Number, String, Object, Array, Set, Map, Error, RegExp, parseInt, parseFloat, isNaN, Promise,
  SpreadsheetApp: conAutoReferencia(self => ({
    getActive: () => libro.proxy,
    getActiveSpreadsheet: () => libro.proxy,
    flush: () => {},
    getUi: () => conAutoReferencia(() => ({
      alert: (...a) => { libro.avisos.push('ALERTA: ' + a.join(' | ')); return 'YES'; },
      ButtonSet: { OK: 'OK', YES_NO: 'YES_NO' }, Button: { YES: 'YES', NO: 'NO' }
    })),
    BorderStyle: { SOLID: 'SOLID', DASHED: 'DASHED', DOTTED: 'DOTTED', SOLID_MEDIUM: 'SOLID_MEDIUM' },
    WrapStrategy: {}, DataValidationCriteria: {}
  })),
  PropertiesService: { getDocumentProperties: () => ({
    getProperty: k => propiedades.has(k) ? propiedades.get(k) : null,
    setProperty: (k, v) => { propiedades.set(k, String(v)); },
    deleteProperty: k => { propiedades.delete(k); }
  }) },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => conAutoReferencia(() => ({})) },
  Utilities: { sleep: () => {} },
  LockService: { getDocumentLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {}, hasLock() { return true; } }) },
  Logger: { log: m => consola.push(String(m)) },
  HtmlService: { createHtmlOutputFromFile: () => conAutoReferencia(() => ({})) }
};
vm.createContext(sandbox);

const codigo = fs.readFileSync(RUTA, 'utf8');
try {
  vm.runInContext(codigo, sandbox, { filename: path.basename(RUTA) });
} catch (e) {
  console.error('ERROR al cargar el script (orden de archivos o referencias a nivel superior):\n  ' + e.message);
  process.exit(2);
}

// Sustituye el reporte gráfico por uno de consola.
let resumen = null;
vm.runInContext(`mostrarReporte_ = function (suites) { globalThis.__suites = suites; };`, sandbox);

const correr = nombre => vm.runInContext(nombre + '()', sandbox);

console.log('Preparando libro simulado…');
try { correr('prepararLibro'); }
catch (e) { console.error('ERROR en prepararLibro: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')); process.exit(3); }

const filtro = process.argv[3] || '';
try { correr('probarTodo'); }
catch (e) { console.error('ERROR al ejecutar probarTodo: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')); process.exit(4); }

const suites = sandbox.__suites || [];
let total = 0, ok = 0;
suites.forEach(s => {
  const aprob = s.resultados.filter(r => r.ok).length;
  total += s.resultados.length; ok += aprob;
  console.log('── ' + s.nombre + ' (' + aprob + '/' + s.resultados.length + ')');
  s.resultados.filter(r => !r.ok || filtro === 'v').forEach(r => console.log('   ' + (r.ok ? '✔ ' : '✘ ') + r.texto));
});
console.log('\nTOTAL: ' + ok + '/' + total + ' pruebas aprobadas (hoja SIMULADA; confirma también en Google Sheets).');
process.exit(ok === total ? 0 : 1);
