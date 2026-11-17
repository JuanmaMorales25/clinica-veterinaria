import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Encabezado } from '../../../compartido/encabezado/encabezado';

@Component({
  selector: 'cv-inicio',
  imports: [RouterLink, Encabezado],
  template: `
    <cv-encabezado titulo="Clínica Veterinaria" [conAtras]="false" />
    <main class="contenido">
      <section class="bienvenida tarjeta">
        <p class="bienvenida__sobrelinea">Cuidamos de quienes te acompañan</p>
        <h2 class="titulo-pagina">La salud de tu mascota, en buenas manos</h2>
        <p class="texto-suave">
          Solicita una cita, consulta el carné digital y mantente al día con sus próximas vacunas.
        </p>
        <div class="acciones">
          <a class="boton boton--primario" routerLink="/acceso/iniciar-sesion">Iniciar sesión</a>
          <a class="boton boton--secundario" routerLink="/acceso/registro">Crear cuenta</a>
        </div>
      </section>
    </main>
  `,
  styles: `
    .bienvenida {
      gap: 20px;
      padding: clamp(28px, 6vw, 56px);
    }
    .bienvenida__sobrelinea {
      color: var(--color-exito);
      font-size: var(--texto-meta);
      font-weight: 600;
    }
    .bienvenida .titulo-pagina {
      max-width: 620px;
    }
    .bienvenida .texto-suave {
      max-width: 540px;
    }
    .acciones a {
      min-width: 175px;
    }
  `,
})
export default class Inicio {}
