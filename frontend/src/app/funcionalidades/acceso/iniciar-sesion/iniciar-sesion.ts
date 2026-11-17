import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { escucharTeclaDemo } from '../../../core/demo/demo.service';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';

@Component({
  selector: 'cv-iniciar-sesion',
  imports: [FormsModule, RouterLink, Aviso, Encabezado],
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
          @if (codigoError() === 'CREDENCIALES_INCORRECTAS') {
            <cv-aviso tipo="alerta" titulo="Credenciales incorrectas">
              <p>{{ error() }}</p>
              @if (intentosRestantes() !== null) {
                <p>Intentos restantes: {{ intentosRestantes() }}</p>
              }
            </cv-aviso>
          } @else if (codigoError() === 'CUENTA_BLOQUEADA') {
            <cv-aviso tipo="alerta" titulo="Cuenta bloqueada">
              <p>{{ error() }}</p>
              <a routerLink="/acceso/recuperar">Restablecer contraseña</a>
            </cv-aviso>
          } @else {
            <p class="ayuda-error" role="alert">{{ error() }}</p>
          }
        }
        <div class="acciones">
          <button class="boton boton--primario" type="submit" [disabled]="enviando()">
            Soy Propietario 🐾
          </button>
          <button class="boton boton--secundario" type="submit" [disabled]="enviando()">
            👩‍⚕️ Acceso personal
          </button>
        </div>
        <div class="enlaces">
          <a routerLink="/acceso/recuperar">Olvidé mi contraseña</a>
          <p>¿No tienes cuenta? <a routerLink="/acceso/registro">Regístrate</a></p>
        </div>
      </form>
    </main>
  `,
  styles: `
    .enlaces {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px 20px;
      font-size: var(--texto-meta);
    }
  `,
})
export default class IniciarSesion {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected correo = '';
  protected contrasena = '';
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly codigoError = signal<string | null>(null);
  protected readonly intentosRestantes = signal<number | null>(null);

  constructor() {
    escucharTeclaDemo('1', () => {
      if (this.correo.trim()) {
        this.contrasena = 'clave-de-demostracion-incorrecta';
        this.entrar();
      }
    });
  }

  protected entrar(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.codigoError.set(null);
    this.intentosRestantes.set(null);
    this.sesion.iniciarSesion(this.correo, this.contrasena).subscribe({
      next: () => this.router.navigateByUrl(this.sesion.rutaInicio()),
      error: (error: unknown) => {
        const respuesta = leerErrorApi(error);
        this.codigoError.set(respuesta.codigo);
        this.error.set(respuesta.mensaje);
        const restantes = respuesta.detalle['intentos_restantes'];
        this.intentosRestantes.set(typeof restantes === 'number' ? restantes : null);
        this.enviando.set(false);
      },
    });
  }
}
