import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { AgendaService } from '../agenda.service';
import { MascotaAgendada, ServicioAgendado } from '../agenda.modelos';

/** M1.1 Elegir servicio. */
@Component({
  selector: 'cv-agendar-servicio',
  imports: [FormsModule, Encabezado],
  template: `
    <cv-encabezado titulo="Agendar cita" rutaAtras="/propietario/agendar" />
    <main class="contenido">
      <h2 class="titulo-pagina">Elige el servicio</h2>
      @if (mascota(); as mascota) {
        <div class="chips">
          <span class="chip">Mascota: {{ mascota.nombre }} · {{ mascota.especie }}</span>
        </div>
      }
      @if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
      <fieldset class="servicios">
        <legend class="solo-lectores">Servicio</legend>
        @for (servicio of servicios(); track servicio.id) {
          <label class="servicio" [class.servicio--activo]="elegido() === servicio.id">
            <span class="servicio__nombre">
              <input
                type="radio"
                name="servicio"
                [value]="servicio.id"
                [checked]="elegido() === servicio.id"
                (change)="elegido.set(servicio.id)"
              />
              {{ servicio.nombre }}
            </span>
            <span>{{ servicio.descripcion }}</span>
            <small>Duración estimada: {{ servicio.duracion_estimada }} min</small>
          </label>
        }
      </fieldset>
      <div class="acciones">
        <button
          type="button"
          class="boton boton--primario"
          [disabled]="!elegido()"
          (click)="continuar()"
        >
          Continuar
        </button>
        <button type="button" class="boton boton--secundario" (click)="volver()">Volver</button>
      </div>
    </main>
  `,
  styles: `
    .servicios {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .servicio {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px 18px;
      font-size: var(--texto-cuerpo);
      background: var(--color-superficie);
      border: 1.5px solid var(--color-borde);
      border-radius: 12px;
      cursor: pointer;
      small {
        color: var(--color-texto-suave);
        font-size: var(--texto-meta);
      }
      &:has(input:focus-visible) {
        outline: 3px solid var(--color-primario-suave);
      }
    }
    .servicio--activo {
      background: var(--color-primario-suave);
      border: 2px solid var(--color-primario);
    }
    .servicio__nombre {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--color-marino);
      font-size: var(--texto-destacado);
      font-weight: 600;
      input {
        width: 16px;
        height: 16px;
        accent-color: var(--color-primario);
      }
    }
    @media (max-width: 640px) {
      .servicios {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export default class AgendarServicio {
  private readonly agenda = inject(AgendaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly mascotaId = this.route.snapshot.paramMap.get('mascotaId') ?? '';
  protected readonly servicios = signal<ServicioAgendado[]>([]);
  protected readonly mascotas = signal<MascotaAgendada[]>([]);
  protected readonly elegido = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly mascota = computed(
    () => this.mascotas().find((mascota) => mascota.id === this.mascotaId) ?? null,
  );

  constructor() {
    this.agenda.servicios().subscribe({
      next: (servicios) => {
        this.servicios.set(servicios);
        this.elegido.set(servicios[0]?.id ?? null);
      },
      error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
    });
    this.agenda.mascotas().subscribe({ next: (mascotas) => this.mascotas.set(mascotas) });
  }

  protected continuar(): void {
    const servicio = this.elegido();
    if (servicio) {
      this.router.navigate(['/propietario/agendar/horario', this.mascotaId, servicio]);
    }
  }

  protected volver(): void {
    this.router.navigate(['/propietario/agendar']);
  }
}
