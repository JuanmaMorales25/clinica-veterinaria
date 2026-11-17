import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { AgendaService } from '../agenda.service';
import { ServicioAgendado } from '../agenda.modelos';

@Component({
  selector: 'cv-agendar-servicio',
  imports: [RouterLink, Encabezado, CurrencyPipe],
  template: `
    <cv-encabezado titulo="Elige el servicio" [rutaAtras]="rutaMascota" />
    <main class="contenido">
      <p class="paso">PASO 2 DE 3</p>
      <h2 class="titulo-pagina">¿Qué necesita tu mascota?</h2>
      @if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
      <div class="lista">
        @for (servicio of servicios(); track servicio.id) {
          <a
            class="servicio tarjeta"
            [routerLink]="['/propietario/agendar/horario', mascotaId, servicio.id]"
          >
            <span class="servicio__datos">
              <strong>{{ servicio.nombre }}</strong>
              <span>{{ servicio.descripcion || 'Atención veterinaria para tu mascota.' }}</span>
              <small
                >{{ servicio.duracion_estimada }} min ·
                {{ servicio.precio | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</small
              >
            </span>
            <span aria-hidden="true">→</span>
          </a>
        } @empty {
          <p class="texto-suave">No hay servicios disponibles en este momento.</p>
        }
      </div>
    </main>
  `,
  styles: `
    .paso {
      color: var(--color-primario);
      font-size: var(--texto-meta);
      font-weight: 700;
    }
    .lista {
      display: grid;
      gap: 12px;
    }
    .servicio {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      color: inherit;
      text-decoration: none;
    }
    .servicio:hover {
      border-color: var(--color-primario);
    }
    .servicio__datos {
      display: grid;
      gap: 6px;
    }
    .servicio__datos strong {
      color: var(--color-marino);
      font-size: var(--texto-destacado);
    }
    .servicio__datos span,
    .servicio__datos small {
      color: var(--color-texto-suave);
    }
  `,
})
export default class AgendarServicio {
  private readonly agenda = inject(AgendaService);
  private readonly route = inject(ActivatedRoute);
  protected readonly mascotaId = this.route.snapshot.paramMap.get('mascotaId') ?? '';
  protected readonly rutaMascota = '/propietario/agendar';
  protected readonly servicios = signal<ServicioAgendado[]>([]);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.agenda.servicios().subscribe({
      next: (servicios) => this.servicios.set(servicios),
      error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
    });
  }
}
