import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { escucharTeclaDemo } from '../../../core/demo/demo.service';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';

@Component({
  selector: 'cv-iniciar-sesion',
  imports: [FormsModule, RouterLink, Aviso, Encabezado, EstadoEtiqueta],
  template: `
    <cv-encabezado titulo="Inicio de Sesión" rutaAtras="/" />
    <main class="contenido">
      @if (codigoError() === 'CUENTA_BLOQUEADA') {
        <section class="tarjeta tarjeta-centrada" aria-labelledby="titulo-bloqueo">
          <cv-estado-etiqueta tipo="advertencia" icono="iconos/candado.svg" tamano="pequeno">
            Cuenta bloqueada
          </cv-estado-etiqueta>
          <h2 id="titulo-bloqueo" class="tarjeta-estado__titulo">
            Bloqueamos tu cuenta por seguridad
          </h2>
          <p>
            Superaste los 5 intentos fallidos consecutivos de inicio de sesión. Para volver a
            ingresar, restablece tu contraseña con un enlace que enviaremos a tu correo registrado.
          </p>
          <cv-aviso tipo="primario" titulo="¿Necesitas ayuda?" icono="iconos/info.svg">
            <p>
              Llámanos o escríbenos y te ayudamos a recuperar el acceso: 604 495 39 04 ·
              patitas&#64;clinica.veterinaria.com
            </p>
          </cv-aviso>
          <a class="boton boton--primario" routerLink="/acceso/recuperar">Restablecer contraseña</a>
          <a class="boton boton--secundario" routerLink="/">Volver al inicio</a>
        </section>
      } @else {
        <form class="tarjeta tarjeta-centrada" (ngSubmit)="entrar()">
          @if (codigoError() === 'CREDENCIALES_INCORRECTAS') {
            <cv-aviso
              tipo="advertencia"
              titulo="Credenciales incorrectas"
              icono="iconos/advertencia-ambar.svg"
            >
              <p>
                El correo o la contraseña no coinciden.
                @if (intentosRestantes() !== null) {
                  Te quedan {{ intentosRestantes() }} intentos antes de que la cuenta se bloquee.
                }
              </p>
            </cv-aviso>
          } @else if (error()) {
            <p class="ayuda-error" role="alert">{{ error() }}</p>
          }
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
              [class.entrada--advertencia]="codigoError() === 'CREDENCIALES_INCORRECTAS'"
              type="password"
              name="contrasena"
              placeholder="escriba su contraseña"
              autocomplete="current-password"
              required
              [(ngModel)]="contrasena"
            />
            @if (codigoError() === 'CREDENCIALES_INCORRECTAS') {
              <p class="ayuda-advertencia">
                <img src="iconos/advertencia-ambar.svg" alt="" width="16" height="16" />
                La contraseña no es correcta.
              </p>
            }
          </div>
          <fieldset class="pildoras">
            <legend class="solo-lectores">Tipo de acceso</legend>
            <label class="pildora">
              <input type="radio" name="rol" value="PROPIETARIO" [(ngModel)]="rol" />
              Soy propietario
            </label>
            <label class="pildora">
              <input type="radio" name="rol" value="PERSONAL" [(ngModel)]="rol" />
              Acceso personal
            </label>
          </fieldset>
          <button class="boton boton--primario" type="submit" [disabled]="enviando()">
            {{ enviando() ? 'Ingresando…' : 'Iniciar sesión' }}
          </button>
          <div class="enlaces">
            <a routerLink="/acceso/recuperar">¿Olvidaste tu contraseña?</a>
            <a routerLink="/acceso/registro">¿No tienes cuenta? Regístrate</a>
          </div>
        </form>
      }
    </main>
  `,
  styles: `
    .enlaces {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      font-size: var(--texto-meta);
      font-weight: 600;
      a {
        color: var(--color-marino);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    }
    .entrada--advertencia {
      border: 2px solid var(--color-advertencia);
    }
    .ayuda-advertencia {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--color-advertencia);
      font-size: var(--texto-meta);
    }
  `,
})
export default class IniciarSesion {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected correo = '';
  protected contrasena = '';
  protected rol: 'PROPIETARIO' | 'PERSONAL' = 'PROPIETARIO';
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
