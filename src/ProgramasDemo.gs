/**
 * ProgramasDemo.gs
 * Programa demostrativo obligatorio: multiplicación por sumas sucesivas.
 *
 *   res = a × b  sumando "a" tantas veces como indica "b".
 *   Usa un bucle (JMP), una bifurcación condicional (CMP + JZ), lectura y
 *   escritura en el segmento de datos (LOAD / STORE) y termina con HLT.
 *
 * Como la ISA no tiene ADD con operando en memoria y solo hay dos registros
 * (AX y BX), el acumulado "res" y el contador "b" viven en memoria y se leen
 * y escriben en cada vuelta: así se ve bien el uso de MAR y MDR.
 *
 * Con a = 5 y b = 3 el resultado es RAM[82h] = 0Fh (15).
 */

const PROGRAMA_DEMO = [
  '; Multiplicación por sumas sucesivas: res = a × b',
  '; Resultado esperado: RAM[82h] = 0Fh (15)',
  '.data',
  'a      DB 5           ; multiplicando          -> 80h',
  'b      DB 3           ; multiplicador/contador -> 81h',
  'res    DB 0           ; resultado              -> 82h',
  '.code',
  '       MOV AX, 0      ; res = 0',
  '       STORE [res], AX',
  'bucle: LOAD BX, [b]   ; ¿quedan vueltas?',
  '       CMP BX, 0',
  '       JZ fin         ; si b = 0 terminar',
  '       DEC BX         ; b = b - 1',
  '       STORE [b], BX',
  '       LOAD AX, [res] ; res = res + a',
  '       LOAD BX, [a]',
  '       ADD AX, BX',
  '       STORE [res], AX',
  '       JMP bucle',
  'fin:   HLT'
];

/** El mismo programa escrito en el lenguaje de alto nivel (hoja Código, columna B). */
const PROGRAMA_DEMO_ALTO = [
  '// Multiplicación por sumas sucesivas: res = a × b',
  'var a = 5',
  'var b = 3',
  'var res = 0',
  'mientras b != 0 {',
  '  res = res + a',
  '  b = b - 1',
  '}'
];

const ProgramasDemo = {

  /** Escribe el programa demo en la columna Ensamblador de la hoja Código. */
  escribirEnHoja() {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    hoja.getRange(4, 5, 100, 1).clearContent();
    hoja.getRange(4, 5, PROGRAMA_DEMO.length, 1).setValues(PROGRAMA_DEMO.map(l => [l]));
  },

  /** Escribe el demo en la hoja, lo ensambla y lo carga en RAM. */
  cargar() {
    ProgramasDemo.escribirEnHoja();
    return Simulacion.cargar();
  },

  /** Escribe el demo de alto nivel en la columna B, lo compila y lo carga. */
  cargarAlto() {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    hoja.getRange(4, 2, 100, 1).clearContent();
    hoja.getRange(4, 2, PROGRAMA_DEMO_ALTO.length, 1).setValues(PROGRAMA_DEMO_ALTO.map(l => [l]));
    return Simulacion.compilar();
  }
};

function menuCargarDemo() {
  const r = ProgramasDemo.cargar();
  SpreadsheetApp.getActive().toast(r.mensaje + ' Resultado esperado: RAM[82h] = 0Fh.', 'Programa demo', 5);
}

function panelDemo() {
  return ProgramasDemo.cargar();
}

function menuCargarDemoAlto() {
  const r = ProgramasDemo.cargarAlto();
  SpreadsheetApp.getActive().toast(r.mensaje + ' Resultado esperado: res = 0Fh.', 'Demo de alto nivel', 5);
}

function panelDemoAlto() {
  return ProgramasDemo.cargarAlto();
}
