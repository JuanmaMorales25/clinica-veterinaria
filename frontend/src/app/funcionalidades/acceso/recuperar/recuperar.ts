import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';

@Component({
  selector: 'cv-recuperar-acceso',
  imports: [FormsModule, RouterLink, Aviso, Encabezado],
  template: `
    <cv-encabezado titulo="Recupera tu acceso" rutaAtras="/acceso/iniciar-sesion" />
    <main class="contenido">
      <form class="tarjeta" (ngSubmit)="enviar()">
        @if (enviado()) {
          <cv-aviso tipo="exito" titulo="Revisa tu correo">
            <p>Si la cuenta existe, enviaremos un enlace para restablecer la contraseña.</p>
          </cv-aviso>
          <a class="boton boton--primario" routerLink="/acceso/iniciar-sesion">
            Volver a iniciar sesión
          </a>
        } @else {
          <h2 class="tarjeta__titulo">Restablecer contraseña</h2>
          <p class="texto-suave">
            Escribe el correo de tu cuenta. Si está registrado, recibirás un enlace de recuperación.
          </p>
          <div class="campo">
            <label for="correo">Correo electrónico</label>
            <input
              id="correo"
              class="entrada"
              type="email"
              name="correo"
              autocomplete="email"
              required
              [(ngModel)]="correo"
            />
          </div>
          @if (error()) {
            <p class="ayuda-error" role="alert">{{ error() }}</p>
          }
          <button class="boton boton--primario" type="submit" [disabled]="enviando()">
            {{ enviando() ? 'Enviando…' : 'Enviar enlace' }}
          </button>
        }
      </form>
    </main>
  `,
})
export default class Recuperar {
  private readonly sesion = inject(SesionService);

  protected correo = '';
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected enviar(): void {
    this.enviando.set(true);
    this.error.set(null);
    this.sesion.solicitarRecuperacion(this.correo.trim()).subscribe({
      next: () => {
        this.enviado.set(true);
        this.enviando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.enviando.set(false);
      },
    });
  }
}
