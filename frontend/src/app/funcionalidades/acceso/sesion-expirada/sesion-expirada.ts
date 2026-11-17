import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';

@Component({
  selector: 'cv-sesion-expirada',
  imports: [RouterLink, Aviso, Encabezado],
  template: `
    <cv-encabezado titulo="Sesión finalizada" [conAtras]="false" />
    <main class="contenido">
      <section class="tarjeta">
        <cv-aviso tipo="info" titulo="Tu sesión expiró">
          <p>Por seguridad, cerramos tu sesión después de 30 minutos sin actividad.</p>
        </cv-aviso>
        <a class="boton boton--primario" routerLink="/acceso/iniciar-sesion">
          Iniciar sesión de nuevo
        </a>
      </section>
    </main>
  `,
})
export default class SesionExpirada {}
