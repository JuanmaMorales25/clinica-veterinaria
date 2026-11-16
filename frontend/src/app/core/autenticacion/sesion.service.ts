import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ROLES_PERSONAL, RespuestaLogin, Usuario } from './modelos';

const CLAVE_TOKEN = 'cv.token';
const CLAVE_USUARIO = 'cv.usuario';

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string | null): void {
  try {
    if (valor === null) {
      localStorage.removeItem(clave);
    } else {
      localStorage.setItem(clave, valor);
    }
  } catch {
    // Sin almacenamiento disponible la sesión dura lo que dure la pestaña.
  }
}

@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);

  readonly token = signal<string | null>(leer(CLAVE_TOKEN));
  readonly usuario = signal<Usuario | null>(JSON.parse(leer(CLAVE_USUARIO) ?? 'null'));
  readonly autenticado = computed(() => this.token() !== null && this.usuario() !== null);
  readonly esPersonal = computed(() => {
    const usuario = this.usuario();
    return usuario !== null && ROLES_PERSONAL.includes(usuario.rol);
  });

  iniciarSesion(correo: string, contrasena: string): Observable<RespuestaLogin> {
    return this.http
      .post<RespuestaLogin>(`${environment.apiUrl}/acceso/login`, { correo, contrasena })
      .pipe(tap((respuesta) => this.guardar(respuesta.token, respuesta.usuario)));
  }

  actualizarToken(token: string): void {
    this.token.set(token);
    escribir(CLAVE_TOKEN, token);
  }

  cerrarSesion(): void {
    this.token.set(null);
    this.usuario.set(null);
    escribir(CLAVE_TOKEN, null);
    escribir(CLAVE_USUARIO, null);
  }

  /** Ruta de inicio según el rol: el personal entra a buscar pacientes (M2.1). */
  rutaInicio(): string {
    return this.esPersonal() ? '/personal/pacientes' : '/propietario';
  }

  private guardar(token: string, usuario: Usuario): void {
    this.token.set(token);
    this.usuario.set(usuario);
    escribir(CLAVE_TOKEN, token);
    escribir(CLAVE_USUARIO, JSON.stringify(usuario));
  }
}
