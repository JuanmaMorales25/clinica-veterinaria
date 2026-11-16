import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SesionService } from './sesion.service';

const CABECERA_TOKEN_RENOVADO = 'X-Token-Renovado';

/**
 * Agrega el token a las peticiones de la API, guarda el token renovado que devuelve
 * cada respuesta y, si la sesión venció, lleva a la pantalla correspondiente (A4).
 */
export const interceptorSesion: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  const token = sesion.token();
  const esApi = peticion.url.startsWith(environment.apiUrl);

  const conToken =
    token && esApi
      ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : peticion;

  return siguiente(conToken).pipe(
    tap((evento) => {
      if (evento instanceof HttpResponse) {
        const renovado = evento.headers.get(CABECERA_TOKEN_RENOVADO);
        if (renovado) {
          sesion.actualizarToken(renovado);
        }
      }
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && esApi && token) {
        const vencida = error.error?.codigo === 'SESION_EXPIRADA';
        sesion.cerrarSesion();
        router.navigate([vencida ? '/acceso/sesion-expirada' : '/acceso/iniciar-sesion']);
      }
      return throwError(() => error);
    }),
  );
};
