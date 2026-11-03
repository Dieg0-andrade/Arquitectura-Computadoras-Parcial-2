/**
 * pruebas/PruebasRegistros.gs
 * Pruebas del banco de registros. Guarda el estado actual y lo restaura al final.
 */

function probarRegistros() {
  mostrarReporte_([suiteRegistros_()]);
}

function suiteRegistros_() {
  const t = crearSuite_('Registros');
  const respaldo = Registros.instantanea();

  try {
    t.prueba('escribir/leer en todos los registros de 8 bits', () => {
      LISTA_REGISTROS.forEach((r, i) => {
        Registros.escribir(r, 0x10 + i);
        t.igual(Registros.leer(r), 0x10 + i);
      });
    });
    t.prueba('escribir rechaza valores fuera de 8 bits', () => {
      t.lanzaError(() => Registros.escribir('AX', 256));
      t.lanzaError(() => Registros.escribir('AX', -1));
    });
    t.prueba('escribir rechaza registros que no existen', () => {
      t.lanzaError(() => Registros.escribir('EX', 1));
    });
    t.prueba('CX y DX son registros de 8 bits con rango propio en la hoja', () => {
      ['CX', 'DX'].forEach(r => {
        t.igual(Registros.esRegistro(r), true);
        Registros.escribir(r, 0xFF);
        t.igual(Registros.leer(r), 0xFF);
        Registros.escribir(r, 0);
        t.igual(Registros.leer(r), 0);
        t.lanzaError(() => Registros.escribir(r, 256));
        t.lanzaError(() => Registros.escribir(r, -1));
      });
    });
    t.prueba('AX, BX, CX y DX no se pisan entre sí', () => {
      ['AX', 'BX', 'CX', 'DX'].forEach((r, i) => Registros.escribir(r, 0xA0 + i));
      ['AX', 'BX', 'CX', 'DX'].forEach((r, i) => t.igual(Registros.leer(r), 0xA0 + i));
    });
    t.prueba('la instantánea incluye CX y DX', () => {
      Registros.escribir('CX', 0x12); Registros.escribir('DX', 0x34);
      const s = Registros.instantanea();
      t.igual(s.CX, 0x12); t.igual(s.DX, 0x34);
    });
    t.prueba('escribirBanderas actualiza solo las banderas indicadas', () => {
      Registros.escribirBanderas({ ZF: 1, CF: 0, SF: 1 });
      Registros.escribirBanderas({ CF: 1 });
      const f = Registros.leerBanderas();
      t.igual(f.ZF, 1); t.igual(f.CF, 1); t.igual(f.SF, 1);
    });
    t.prueba('reiniciar deja todo en cero y el estado en LISTO', () => {
      Registros.reiniciar();
      LISTA_REGISTROS.forEach(r => t.igual(Registros.leer(r), 0));
      const f = Registros.leerBanderas();
      t.igual(f.ZF + f.CF + f.SF, 0);
      t.igual(Registros.leerTexto('ESTADO'), 'LISTO');
    });
  } finally {
    LISTA_REGISTROS.forEach(r => Registros.escribir(r, respaldo[r]));
    Registros.escribirBanderas({ ZF: respaldo.ZF, CF: respaldo.CF, SF: respaldo.SF });
  }

  return t;
}
