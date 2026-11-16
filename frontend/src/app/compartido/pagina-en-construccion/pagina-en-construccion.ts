import { Component, input } from '@angular/core';

import { Encabezado } from '../encabezado/encabezado';

/** Ocupa las rutas mientras se construye cada pantalla. Se reemplaza al implementarla. */
@Component({
  selector: 'cv-pagina-en-construccion',
  imports: [Encabezado],
  template: `
    <cv-encabezado [titulo]="titulo()" />
    <main class="contenido">
      <section class="tarjeta">
        <p class="texto-suave">Esta pantalla todavía se está construyendo.</p>
      </section>
    </main>
  `,
})
export default class PaginaEnConstruccion {
  /** Llega desde data.titulo de la ruta. */
  readonly titulo = input('Clínica Veterinaria');
}
