import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Encabezado } from '../../../compartido/encabezado/encabezado';

@Component({
  selector: 'cv-iniciar-sesion',
  imports: [FormsModule, RouterLink, Encabezado],
  template: `
    <cv-encabezado titulo="Inicio de Sesión" rutaAtras="/" />
    <main class="contenido">
      <form class="tarjeta" (ngSubmit)="entrar()">
        <h2 class="tarjeta__titulo">Iniciar Sesión</h2>
        <div class="campo">
          <label for="correo">Email</label>
          <input
            id="correo"
            class="entrada"
            type="email"
            name="correo"
            placeholder="tu@email.com"
            autocomplete="username"
            required
            [(ngModel)]="correo"
          />
        </div>
        <div class="campo">
          <label for="contrasena">Contraseña</label>
          <input
            id="contrasena"
            class="entrada"
            type="password"
            name="contrasena"
            placeholder="escriba su contraseña"
            autocomplete="current-password"
            required
            [(ngModel)]="contrasena"
          />
        </div>
        @if (error()) {
          <p class="ayuda-error" role="alert">{{ error() }}</p>
        }
        <div class="acciones">
          <button class="boton boton--primario" type="submit" [disabled]="enviando()">
            Soy Propietario 🐾
          </button>
          <button class="boton boton--secundario" type="submit" [disabled]="enviando()">
            👩‍⚕️ Acceso personal
          </button>
        </div>
        <p>¿No tienes cuenta? <a routerLink="/acceso/registro">Regístrate</a></p>
      </form>
    </main>
  `,
})
export default class IniciarSesion {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected correo = '';
  protected contrasena = '';
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected entrar(): void {
    this.enviando.set(true);
    this.error.set(null);
    this.sesion.iniciarSesion(this.correo, this.contrasena).subscribe({
      next: () => this.router.navigateByUrl(this.sesion.rutaInicio()),
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.enviando.set(false);
      },
    });
  }
}
