/**
 * Teclado FIFO de 8 bytes.
 *
 * Direcciones virtuales: 1F0h–1F7h.
 * Direcciones físicas:   F0h–F7h (página 15 fija en marco 7).
 *
 * Los bytes viven en RAM. Entre ejecuciones de Apps Script solo se
 * guardan dos números: la cabeza de la cola y su longitud.
 */
const Perifericos = {
  teclado: {
    CAPACIDAD: 8,
    BASE: 0xF0,
    CLAVE: 'TECLADO_FIFO_V1',

    indices_() {
      const texto = PropertiesService.getDocumentProperties()
        .getProperty(Perifericos.teclado.CLAVE);

      return texto ? JSON.parse(texto) : { cabeza: 0, longitud: 0 };
    },

    guardar_(indices) {
      PropertiesService.getDocumentProperties()
        .setProperty(Perifericos.teclado.CLAVE, JSON.stringify(indices));
    },

    // En Sheets evita que dos ediciones simultáneas ocupen el mismo lugar.
    // El simulador local de Node ejecuta las operaciones en secuencia.
    conBloqueo_(accion) {
      if (typeof LockService === 'undefined') return accion();

      const bloqueo = LockService.getDocumentLock();
      bloqueo.waitLock(5000);
      try {
        return accion();
      } finally {
        SpreadsheetApp.flush();
        bloqueo.releaseLock();
      }
    },

    encolar(caracter) {
      if (typeof caracter !== 'string' ||
          caracter.length !== 1 ||
          caracter.charCodeAt(0) > 127) {
        throw new Error('Ingresá un solo carácter ASCII. Ejemplos: A, b, 7.');
      }

      const k = Perifericos.teclado;
      return k.conBloqueo_(() => {
        const indices = k.indices_();
        if (indices.longitud === k.CAPACIDAD) return false;

        const cola = (indices.cabeza + indices.longitud) % k.CAPACIDAD;
        Memoria.escribir(k.BASE + cola, caracter.charCodeAt(0));

        indices.longitud++;
        k.guardar_(indices);
        k.mostrar_(indices);
        return true;
      });
    },

    desencolar() {
      const k = Perifericos.teclado;
      return k.conBloqueo_(() => {
        const indices = k.indices_();
        if (indices.longitud === 0) return 0;

        const direccion = k.BASE + indices.cabeza;
        const byte = Memoria.leer(direccion);
        Memoria.escribir(direccion, 0);

        indices.cabeza = (indices.cabeza + 1) % k.CAPACIDAD;
        indices.longitud--;
        k.guardar_(indices);
        k.mostrar_(indices);
        return byte;
      });
    },

    contenido_(indices) {
      const k = Perifericos.teclado;
      const bytes = [];

      for (let i = 0; i < indices.longitud; i++) {
        const posicion = (indices.cabeza + i) % k.CAPACIDAD;
        bytes.push(Memoria.leer(k.BASE + posicion));
      }

      return bytes;
    },

    estado() {
      const k = Perifericos.teclado;
      const indices = k.indices_();
      return {
        capacidad: k.CAPACIDAD,
        longitud: indices.longitud,
        contenido: k.contenido_(indices)
      };
    },

    mostrar_(indices) {
      const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CACHE_IO);
      if (!hoja) return;

      const bytes = Perifericos.teclado.contenido_(indices);
      const fila = bytes.map(UtilMemoria.aHex);
      while (fila.length < 8) fila.push('—');

      // El panel muestra el orden de salida. La RAM conserva el anillo físico.
      hoja.getRange('B31:I31').setNumberFormat('@').setValues([fila]);
      hoja.getRange('B32').setValue('FIFO: ' + bytes.length + '/8');
    },

    reiniciar() {
      const k = Perifericos.teclado;
      return k.conBloqueo_(() => {
        const indices = { cabeza: 0, longitud: 0 };

        for (let i = 0; i < k.CAPACIDAD; i++) {
          Memoria.escribir(k.BASE + i, 0);
        }

        k.guardar_(indices);
        k.mostrar_(indices);
      });
    },

    atenderEdicion(e) {
      if (!e || !e.range) return false;

      const rango = e.range;
      const hoja = rango.getSheet();

      // C33 es la esquina superior izquierda de la entrada combinada C33:I33.
      if (hoja.getName() !== HOJAS.CACHE_IO ||
          rango.getRow() !== 33 || rango.getColumn() !== 3) {
        return false;
      }

      if (e.value === undefined || e.value === '') return true;

      try {
        const guardado = Perifericos.teclado.encolar(String(e.value));

        if (guardado) {
          hoja.getRange('C33').clearContent();
        } else {
          e.source.toast('Cola llena (8/8). Leé un byte antes de ingresar otro.', 'Teclado', 4);
        }
      } catch (error) {
        e.source.toast(error.message, 'Teclado', 5);
      }

      return true;
    }
  },

  // El LCD corresponde a la tarea 19.
  lcd: {
    escribir(posicion, byte) {
      if (!Number.isInteger(posicion) || posicion < 0 || posicion > 7) {
        throw new Error('Posición de LCD fuera de rango: ' + posicion + ' (válido 0–7)');
      }
      UtilMemoria.validarByte(byte);
    },

    texto() {
      return '        ';
    }
  }
};