import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';

/** A4: la sesión se cerró tras 30 minutos sin actividad (la tecla 2 la provoca en la demostración). */
@Component({
  selector: 'cv-sesion-expirada',
  imports: [RouterLink, Encabezado, EstadoEtiqueta],
  template: `
    <cv-encabezado titulo="Inicio de Sesión" [conAtras]="false" />
    <main class="contenido">
      <section class="tarjeta tarjeta-centrada tarjeta-estado" aria-labelledby="titulo-expirada">
        <img class="tarjeta-estado__icono" src="iconos/reloj.svg" alt="" />
        <cv-estado-etiqueta tipo="advertencia" icono="iconos/reloj.svg" tamano="pequeno">
          Sesión expirada
        </cv-estado-etiqueta>
        <h2 id="titulo-expirada" class="tarjeta-estado__titulo">
          Tu sesión se cerró por inactividad
        </h2>
        <p>
          Por seguridad cerramos la sesión tras 30 minutos sin actividad. Si estabas registrando una
          atención, recuperarás el borrador al volver a ingresar.
        </p>
        <a class="boton boton--primario" routerLink="/acceso/iniciar-sesion">
          Iniciar sesión de nuevo
        </a>
      </section>
    </main>
  `,
})
export default class SesionExpirada {}
