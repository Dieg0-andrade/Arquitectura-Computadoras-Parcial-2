/**
 * Perifericos.gs  —  STUB (tarea 1-2). La implementación real son las tareas 3-5 y 3-6 (Integrante 3).
 *
 * Periféricos mapeados en memoria (decisión D-3, página 15 fija en el marco 7):
 *   teclado: cola circular de 8 bytes en 1F0h–1F7h
 *   lcd:     buffer de video de 8 bytes en 1F8h–1FFh (pantalla 8x1)
 *
 * CONTRATO (no cambiar sin avisar):
 *   Perifericos.teclado.encolar(char)     -> true si se guardó, false si la cola está llena
 *   Perifericos.teclado.desencolar()      -> byte (código ASCII) o 0 si la cola está vacía
 *   Perifericos.teclado.estado()          -> { capacidad, longitud, contenido[] }
 *   Perifericos.lcd.escribir(pos, byte)   -> escribe un byte en la posición 0..7 del buffer
 *   Perifericos.lcd.texto()               -> texto de 8 caracteres que muestra la pantalla
 *
 * El stub no guarda nada: la cola siempre está vacía y la pantalla en blanco.
 */

const Perifericos = {

  teclado: {
    encolar(caracter) { return false; },
    desencolar() { return 0; },
    estado() { return { capacidad: 8, longitud: 0, contenido: [] }; }
  },

  lcd: {
    escribir(posicion, byte) {
      if (!Number.isInteger(posicion) || posicion < 0 || posicion > 7) {
        throw new Error('Posición de LCD fuera de rango: ' + posicion + ' (válido 0–7)');
      }
      UtilMemoria.validarByte(byte);
    },
    texto() { return '        '; }
  }
};
