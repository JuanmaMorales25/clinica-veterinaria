import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Encabezado } from '../../../compartido/encabezado/encabezado';

@Component({
  selector: 'cv-restablecer-contrasena',
  imports: [FormsModule, RouterLink, Encabezado],
  template: `
    <cv-encabezado titulo="Nueva contraseña" rutaAtras="/acceso/iniciar-sesion" />
    <main class="contenido">
      <form class="tarjeta" (ngSubmit)="guardar()">
        @if (guardada()) {
          <h2 class="tarjeta__titulo">Contraseña actualizada</h2>
          <p class="texto-suave">Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <a class="boton boton--primario" routerLink="/acceso/iniciar-sesion">
            Iniciar sesión
          </a>
        } @else {
          <h2 class="tarjeta__titulo">Elige una contraseña nueva</h2>
          <div class="campo">
            <label for="contrasena">Nueva contraseña</label>
            <input
              id="contrasena"
              class="entrada"
              type="password"
              name="contrasena"
              autocomplete="new-password"
              minlength="8"
              maxlength="128"
              required
              [(ngModel)]="contrasena"
            />
          </div>
          <div class="campo">
            <label for="confirmar">Confirmar contraseña</label>
            <input
              id="confirmar"
              class="entrada"
              type="password"
              name="confirmar"
              autocomplete="new-password"
              required
              [(ngModel)]="confirmacion"
            />
          </div>
          @if (error()) {
            <p class="ayuda-error" role="alert">{{ error() }}</p>
          }
          <button class="boton boton--primario" type="submit" [disabled]="enviando() || !token">
            {{ enviando() ? 'Guardando…' : 'Actualizar contraseña' }}
          </button>
        }
      </form>
    </main>
  `,
})
export default class Restablecer {
  private readonly sesion = inject(SesionService);
  private readonly route = inject(ActivatedRoute);

  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected contrasena = '';
  protected confirmacion = '';
  protected readonly enviando = signal(false);
  protected readonly guardada = signal(false);
  protected readonly error = signal<string | null>(
    this.token ? null : 'El enlace no es válido. Solicita uno nuevo para continuar.',
  );

  protected guardar(): void {
    this.error.set(null);
    if (!this.token) {
      this.error.set('El enlace no es válido. Solicita uno nuevo para continuar.');
      return;
    }
    if (this.contrasena !== this.confirmacion) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.enviando.set(true);
    this.sesion.restablecerContrasena(this.token, this.contrasena).subscribe({
      next: () => {
        this.guardada.set(true);
        this.enviando.set(false);
      },
      error: (error: unknown) => {
        const respuesta = leerErrorApi(error);
        this.error.set(respuesta.mensaje || 'El enlace venció. Solicita uno nuevo.');
        this.enviando.set(false);
      },
    });
  }
}
