import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Encabezado } from '../../../compartido/encabezado/encabezado';

@Component({
  selector: 'cv-registro',
  imports: [FormsModule, RouterLink, Encabezado],
  template: `
    <cv-encabezado titulo="Crea tu cuenta" rutaAtras="/" />
    <main class="contenido">
      <form class="tarjeta" (ngSubmit)="registrar()">
        <h2 class="tarjeta__titulo">Datos del propietario</h2>
        <p class="texto-suave">
          Si ya tienes una mascota registrada, ingresa el correo y teléfono asociados a tu ficha
          para vincularla con la cuenta.
        </p>
        <div class="campo">
          <label for="nombre">Nombre completo</label>
          <input
            id="nombre"
            class="entrada"
            name="nombre"
            autocomplete="name"
            required
            minlength="2"
            maxlength="120"
            [(ngModel)]="nombre"
          />
        </div>
        <div class="campo">
          <label for="documento">Documento de identidad</label>
          <input
            id="documento"
            class="entrada"
            name="documento"
            autocomplete="off"
            required
            minlength="5"
            maxlength="20"
            [(ngModel)]="documentoIdentidad"
          />
        </div>
        <div class="campo">
          <label for="telefono">Teléfono</label>
          <input
            id="telefono"
            class="entrada"
            type="tel"
            name="telefono"
            autocomplete="tel"
            required
            minlength="7"
            maxlength="20"
            [(ngModel)]="telefono"
          />
        </div>
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
        <div class="campo">
          <label for="contrasena">Contraseña</label>
          <input
            id="contrasena"
            class="entrada"
            type="password"
            name="contrasena"
            autocomplete="new-password"
            required
            minlength="8"
            maxlength="128"
            [(ngModel)]="contrasena"
          />
          <p class="texto-suave ayuda">Usa al menos 8 caracteres.</p>
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
        <label class="consentimiento">
          <input type="checkbox" name="autorizacion" required [(ngModel)]="autorizacionDatos" />
          Autorizo el uso de mis datos personales para gestionar la atención de mis mascotas.
        </label>
        @if (error()) {
          <p class="ayuda-error" role="alert">{{ error() }}</p>
        }
        <button class="boton boton--primario" type="submit" [disabled]="enviando()">
          {{ enviando() ? 'Creando cuenta…' : 'Crear cuenta' }}
        </button>
        <p class="texto-suave">
          ¿Ya tienes cuenta? <a routerLink="/acceso/iniciar-sesion">Inicia sesión</a>
        </p>
      </form>
    </main>
  `,
  styles: `
    .consentimiento {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: var(--texto-meta);
    }
    .consentimiento input {
      margin-top: 5px;
      accent-color: var(--color-primario);
    }
  `,
})
export default class Registro {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected nombre = '';
  protected documentoIdentidad = '';
  protected telefono = '';
  protected correo = '';
  protected contrasena = '';
  protected confirmacion = '';
  protected autorizacionDatos = false;
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected registrar(): void {
    this.error.set(null);
    if (this.contrasena !== this.confirmacion) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.enviando.set(true);
    this.sesion
      .registrar({
        nombre: this.nombre.trim(),
        correo: this.correo.trim(),
        contrasena: this.contrasena,
        documento_identidad: this.documentoIdentidad.trim(),
        telefono: this.telefono.trim(),
        autorizacion_datos: this.autorizacionDatos,
      })
      .subscribe({
        next: () => this.router.navigateByUrl(this.sesion.rutaInicio()),
        error: (error: unknown) => {
          const respuesta = leerErrorApi(error);
          this.error.set(mensajeRegistro(respuesta.codigo, respuesta.mensaje));
          this.enviando.set(false);
        },
      });
  }
}

function mensajeRegistro(codigo: string, mensaje: string): string {
  switch (codigo) {
    case 'CORREO_REGISTRADO':
      return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.';
    case 'DATOS_PROPIETARIO_NO_COINCIDEN':
      return 'El documento, correo o teléfono no coinciden con la ficha de la clínica.';
    case 'PROPIETARIO_YA_VINCULADO':
      return 'Este registro ya está vinculado a una cuenta.';
    case 'DATOS_REGISTRO_DUPLICADOS':
      return 'No se pudo crear la cuenta porque uno de los datos ya está registrado.';
    default:
      return mensaje || 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.';
  }
}
