#!/usr/bin/env node
/**
 * construir.js — Une todos los archivos de src/ en un solo script para pegar en Apps Script.
 *
 * Uso (desde la raíz del repo):
 *   node herramientas/construir.js              -> incluye pruebas
 *   node herramientas/construir.js --sin-pruebas
 *
 * Salida:
 *   dist/SimuladorCompleto.gs   (NO editar a mano: se regenera)
 *   dist/Panel.html             (copia del panel lateral, si existe)
 *
 * IMPORTANTE: en Apps Script, las constantes/objetos de nivel superior se evalúan en el
 * orden de los archivos. Si un archivo usa algo de otro al cargarse (no dentro de una
 * función), ese otro debe ir ANTES en esta lista.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SRC = path.join(RAIZ, 'src');
const DIST = path.join(RAIZ, 'dist');
const sinPruebas = process.argv.includes('--sin-pruebas');

// Orden de carga. Los archivos que no estén aquí se agregan al final (con aviso).
const ORDEN = [
  // Base (Parcial 1)
  'Configuracion.gs',
  'Memoria.gs',
  'Registros.gs',
  'ALU.gs',
  'ISA.gs',
  'Bus.gs',
  'EnsambladorLexico.gs',
  'Ensamblador.gs',
  'Compilador.gs',
  'VistaRam.gs',
  'VistaCompilador.gs',
  'Libro.gs',
  'MicroOperaciones.gs',
  'UnidadControl.gs',
  'LogMicroops.gs',
  'Resaltado.gs',
  'Traza.gs',
  'Simulacion.gs',
  'ProgramasDemo.gs',
  'Controles.gs',
  'Principal.gs',
  // Parcial 2 (los archivos que aún no existan se ignoran; agrégalos aquí al crearlos)
  'MicroPalabra.gs',
  'TablaMarcos.gs',
  'Swap.gs',
  'MMU.gs',
  'ManejadorFallos.gs',
  'Cache.gs',
  'Perifericos.gs',
  'AccesoMemoria.gs',
  'VistaCache.gs',
  'VistaBuses.gs',
  'ProgramasCatalogo.gs',
  'Editor.gs'
];
// Pruebas: primero el ejecutor, luego el resto de las suites en orden alfabético.
const EJECUTOR_PRUEBAS = 'EjecutorPruebas.gs';

function listarGs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();
}

const enSrc = listarGs(SRC);
const enPruebas = listarGs(path.join(SRC, 'pruebas'));

const partes = [];
const usados = new Set();

function agregar(rutaRelativa, contenido) {
  partes.push(
    '\n// ' + '='.repeat(70) + '\n' +
    '// ARCHIVO: ' + rutaRelativa + '\n' +
    '// ' + '='.repeat(70) + '\n' +
    contenido.replace(/\r\n/g, '\n').trimEnd() + '\n'
  );
}

// 1) Código en el orden definido
for (const nombre of ORDEN) {
  if (enSrc.includes(nombre)) {
    agregar('src/' + nombre, fs.readFileSync(path.join(SRC, nombre), 'utf8'));
    usados.add(nombre);
  }
}

// 2) Cualquier .gs que no esté en la lista (para no perder código nuevo)
const sobrantes = enSrc.filter(f => !usados.has(f));
for (const nombre of sobrantes) {
  console.warn('AVISO: "' + nombre + '" no está en ORDEN; se agrega al final. Agrégalo a la lista si depende de otros.');
  agregar('src/' + nombre, fs.readFileSync(path.join(SRC, nombre), 'utf8'));
}

// 3) Pruebas
let cantPruebas = 0;
if (!sinPruebas) {
  const orden = enPruebas.filter(f => f === EJECUTOR_PRUEBAS)
    .concat(enPruebas.filter(f => f !== EJECUTOR_PRUEBAS));
  for (const nombre of orden) {
    agregar('src/pruebas/' + nombre, fs.readFileSync(path.join(SRC, 'pruebas', nombre), 'utf8'));
    cantPruebas++;
  }
}

if (partes.length === 0) {
  console.error('ERROR: no se encontró ningún .gs en src/. ¿Estás en la raíz del repo?');
  process.exit(1);
}

const encabezado =
  '// ' + '#'.repeat(70) + '\n' +
  '// SimuladorCompleto.gs — ARCHIVO GENERADO AUTOMÁTICAMENTE. NO EDITAR A MANO.\n' +
  '// Se genera con: node herramientas/construir.js\n' +
  '// Generado: ' + new Date().toISOString() + '\n' +
  '// ' + '#'.repeat(70) + '\n';

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'SimuladorCompleto.gs'), encabezado + partes.join(''), 'utf8');

// Panel.html
const panel = path.join(SRC, 'Panel.html');
if (fs.existsSync(panel)) fs.copyFileSync(panel, path.join(DIST, 'Panel.html'));

const kb = (fs.statSync(path.join(DIST, 'SimuladorCompleto.gs')).size / 1024).toFixed(1);
console.log('OK -> dist/SimuladorCompleto.gs (' + kb + ' KB)');
console.log('   Código: ' + (enSrc.length) + ' archivos · Pruebas: ' + cantPruebas + ' archivos' + (sinPruebas ? ' (omitidas)' : ''));
console.log('   Panel.html: ' + (fs.existsSync(panel) ? 'copiado a dist/' : 'no existe, omitido'));
console.log('Siguiente paso: abre dist/SimuladorCompleto.gs, copia todo y pégalo en Apps Script.');
