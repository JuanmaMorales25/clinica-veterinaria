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
    <cv-encabezado titulo="Recuperar contraseña" rutaAtras="/acceso/iniciar-sesion" />
    <main class="contenido">
      <form class="tarjeta tarjeta-centrada" (ngSubmit)="enviar()">
        <h2 class="tarjeta__titulo">Recupera tu acceso</h2>
        <p class="texto-suave">
          Escribe el correo con el que te registraste y te enviaremos un enlace para crear una
          contraseña nueva.
        </p>
        <div class="campo">
          <label for="correo">Correo electrónico</label>
          <input
            id="correo"
            class="entrada"
            type="email"
            name="correo"
            autocomplete="email"
            placeholder="tu@email.com"
            required
            [(ngModel)]="correo"
          />
        </div>
        @if (error()) {
          <p class="ayuda-error" role="alert">{{ error() }}</p>
        }
        @if (enviado()) {
          <cv-aviso tipo="exito" titulo="Enlace enviado">
            <p>
              Revisa tu bandeja de entrada y la carpeta de spam. El enlace tiene vigencia limitada.
            </p>
          </cv-aviso>
          <a class="boton boton--primario" routerLink="/acceso/iniciar-sesion">
            Volver al inicio de sesión
          </a>
          <button class="boton boton--secundario" type="submit" [disabled]="enviando()">
            {{ enviando() ? 'Enviando…' : 'Reenviar enlace' }}
          </button>
        } @else {
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
