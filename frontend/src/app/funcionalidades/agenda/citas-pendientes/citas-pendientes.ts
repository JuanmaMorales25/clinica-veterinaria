import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { leerErrorApi } from '../../../core/api/error-api';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { AgendaService } from '../agenda.service';
import { CitaAgendada } from '../agenda.modelos';

@Component({
  selector: 'cv-citas-pendientes',
  imports: [Encabezado, EstadoEtiqueta, DatePipe],
  template: `
    <cv-encabezado titulo="Citas por confirmar" rutaAtras="/personal/pacientes" />
    <main class="contenido">
      <h2 class="titulo-pagina">Citas pendientes</h2>
      <p class="texto-suave">Revisa las solicitudes y confirma o cancela cada una.</p>
      @if (error()) { <p class="ayuda-error" role="alert">{{ error() }}</p> }
      @for (cita of citas(); track cita.id) {
        <article class="tarjeta cita">
          <div class="tarjeta__encabezado">
            <div class="cita__datos">
              <h3 class="tarjeta__titulo">{{ cita.mascota }}</h3>
              <p>{{ cita.servicio }}</p>
              <p class="texto-suave">{{ cita.fecha_hora | date:'EEEE d MMMM, h:mm a' }}</p>
              <p class="texto-suave">Veterinario(a): {{ cita.veterinario || 'Sin asignar' }}</p>
            </div>
            <cv-estado-etiqueta tipo="advertencia">Pendiente</cv-estado-etiqueta>
          </div>
          <div class="acciones">
            <button class="boton boton--primario" type="button" [disabled]="procesando() === cita.id" (click)="confirmar(cita)">
              Confirmar
            </button>
            <button class="boton boton--secundario" type="button" [disabled]="procesando() === cita.id" (click)="cancelar(cita)">
              Cancelar solicitud
            </button>
          </div>
        </article>
      } @empty {
        @if (!error()) {
          <section class="tarjeta">
            <h3 class="tarjeta__titulo">No hay solicitudes pendientes</h3>
            <p class="texto-suave">Las nuevas citas solicitadas aparecerán aquí.</p>
          </section>
        }
      }
    </main>
  `,
  styles: `
    .cita { gap: 18px; }
    .cita__datos { display: grid; gap: 5px; }
  `,
})
export default class CitasPendientes {
  private readonly agenda = inject(AgendaService);
  protected readonly citas = signal<CitaAgendada[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly procesando = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  protected confirmar(cita: CitaAgendada): void {
    this.procesando.set(cita.id);
    this.agenda.confirmarCita(cita.id).subscribe({
      next: () => this.cargar(),
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.procesando.set(null);
      },
    });
  }

  protected cancelar(cita: CitaAgendada): void {
    this.procesando.set(cita.id);
    this.agenda.cancelarCita(cita.id, 'Cancelada por el personal').subscribe({
      next: () => this.cargar(),
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.procesando.set(null);
      },
    });
  }

  private cargar(): void {
    this.agenda.citasPendientes().subscribe({
      next: (citas) => {
        this.citas.set(citas);
        this.error.set(null);
        this.procesando.set(null);
      },
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.procesando.set(null);
      },
    });
  }
}
