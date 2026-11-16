import { Location } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { SesionService } from '../../core/autenticacion/sesion.service';

@Component({
  selector: 'cv-encabezado',
  template: `
    <header class="encabezado">
      <button type="button" class="encabezado__atras" (click)="volver()" aria-label="Volver">
        ←
      </button>
      <img class="encabezado__logo" src="logo.png" alt="" width="82" height="82" />
      <h1 class="encabezado__titulo">{{ titulo() }}</h1>
      @if (sesion.autenticado()) {
        <button type="button" class="encabezado__salir" (click)="salir()">Salir</button>
      }
    </header>
  `,
  styles: `
    .encabezado {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 89px;
      padding: 0 96px;
      background: var(--color-encabezado);
    }
    .encabezado__atras {
      position: absolute;
      left: 0;
      top: 23px;
      width: 51px;
      height: 43px;
      background: var(--color-marino);
      border: 0;
      color: #fff;
      font: inherit;
      font-size: 24px;
      font-weight: 700;
      cursor: pointer;
    }
    .encabezado__logo {
      position: absolute;
      left: 65px;
      top: 4px;
      width: 82px;
      height: 82px;
      object-fit: cover;
    }
    .encabezado__titulo {
      color: var(--color-marino);
      font-size: var(--texto-titulo);
      font-weight: 700;
      text-align: center;
    }
    .encabezado__salir {
      position: absolute;
      right: 24px;
      background: none;
      border: 0;
      color: var(--color-primario);
      font: inherit;
      font-size: var(--texto-meta);
      font-weight: 600;
      cursor: pointer;
    }
    @media (max-width: 640px) {
      .encabezado {
        padding: 0 64px;
      }
      .encabezado__logo {
        display: none;
      }
      .encabezado__titulo {
        font-size: var(--texto-destacado);
      }
    }
  `,
})
export class Encabezado {
  readonly titulo = input.required<string>();
  /** Si no se indica, el botón vuelve a la pantalla anterior. */
  readonly rutaAtras = input<string | null>(null);

  protected readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected volver(): void {
    const ruta = this.rutaAtras();
    if (ruta) {
      this.router.navigateByUrl(ruta);
    } else {
      this.location.back();
    }
  }

  protected salir(): void {
    this.sesion.cerrarSesion();
    this.router.navigateByUrl('/');
  }
}
