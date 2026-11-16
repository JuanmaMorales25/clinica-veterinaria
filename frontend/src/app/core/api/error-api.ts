import { HttpErrorResponse } from '@angular/common/http';

/** Forma de los errores de negocio de la API: el código decide qué flujo alterno mostrar. */
export interface ErrorApi {
  codigo: string;
  mensaje: string;
  detalle: Record<string, unknown>;
}

export function leerErrorApi(error: unknown): ErrorApi {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as Partial<ErrorApi> | null;
    if (cuerpo?.codigo) {
      return { codigo: cuerpo.codigo, mensaje: cuerpo.mensaje ?? '', detalle: cuerpo.detalle ?? {} };
    }
    if (error.status === 0) {
      return {
        codigo: 'SIN_CONEXION',
        mensaje: 'No hay conexión con el servidor.',
        detalle: {},
      };
    }
  }
  return { codigo: 'ERROR_DESCONOCIDO', mensaje: 'Ocurrió un error inesperado.', detalle: {} };
}
