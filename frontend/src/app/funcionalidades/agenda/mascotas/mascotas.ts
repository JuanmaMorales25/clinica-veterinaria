import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { AgendaService } from '../agenda.service';
import { MascotaAgendada } from '../agenda.modelos';

@Component({
  selector: 'cv-mascotas-propietario',
  imports: [RouterLink, Encabezado],
  template: `
    <cv-encabezado titulo="Mis mascotas" [conAtras]="false" />
    <main class="contenido">
      <div class="tarjeta__encabezado">
        <div>
          <h2 class="titulo-pagina">Mis mascotas</h2>
          <p class="texto-suave">Consulta su carné o solicita una cita.</p>
        </div>
        <a class="boton boton--primario" routerLink="/propietario/agendar">Agendar una cita</a>
      </div>

      @if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      } @else if (cargando()) {
        <p class="texto-suave" aria-live="polite">Cargando tus mascotas…</p>
      } @else {
        @for (mascota of mascotas(); track mascota.id) {
          <article class="mascota tarjeta">
            <div class="mascota__marca" aria-hidden="true">🐾</div>
            <div class="mascota__datos">
              <h3 class="tarjeta__titulo">{{ mascota.nombre }}</h3>
              <p class="texto-suave">
                {{ mascota.especie }}{{ mascota.raza ? ' · ' + mascota.raza : '' }}
              </p>
              <p class="texto-suave">Historia {{ mascota.numero_historia }}</p>
            </div>
            <a class="boton boton--secundario" [routerLink]="['/propietario/carne', mascota.id]">
              Ver carné
            </a>
          </article>
        } @empty {
          <section class="tarjeta">
            <h3 class="tarjeta__titulo">Aún no hay mascotas vinculadas</h3>
            <p class="texto-suave">
              Agrega el número de historia que te entregó la clínica para encontrar la ficha.
            </p>
            <a class="boton boton--primario" routerLink="/propietario/agendar">Vincular mascota</a>
          </section>
        }
      }
      <a class="enlace" routerLink="/propietario/preferencias">Preferencias de notificación</a>
    </main>
  `,
  styles: `
    .mascota {
      flex-direction: row;
      align-items: center;
    }
    .mascota__marca {
      display: grid;
      place-items: center;
      width: 62px;
      height: 62px;
      flex: 0 0 62px;
      border-radius: 50%;
      background: var(--color-primario-suave);
      font-size: 28px;
    }
    .mascota__datos {
      flex: 1;
      display: grid;
      gap: 5px;
    }
    .enlace {
      align-self: flex-start;
    }
    @media (max-width: 600px) {
      .mascota {
        align-items: flex-start;
        flex-wrap: wrap;
      }
    }
  `,
})
export default class MascotasPropietario {
  private readonly agenda = inject(AgendaService);
  protected readonly mascotas = signal<MascotaAgendada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.agenda.mascotas().subscribe({
      next: (mascotas) => {
        this.mascotas.set(mascotas);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.cargando.set(false);
      },
    });
  }
}
