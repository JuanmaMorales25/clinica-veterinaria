import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { AgendaService } from '../agenda.service';
import { HorarioDisponible } from '../agenda.modelos';

function fechaLocal(valor: Date): string {
  const zona = valor.getTimezoneOffset() * 60_000;
  return new Date(valor.getTime() - zona).toISOString().slice(0, 10);
}

@Component({
  selector: 'cv-agendar-horario',
  imports: [FormsModule, RouterLink, Encabezado, DatePipe],
  template: `
    <cv-encabezado titulo="Fecha y hora" [rutaAtras]="rutaServicio" />
    <main class="contenido">
      <p class="paso">PASO 3 DE 3</p>
      <h2 class="titulo-pagina">Elige cuándo venir</h2>
      <p class="texto-suave">
        La cita quedará pendiente hasta que el personal de la clínica la confirme.
      </p>

      <label class="campo fecha">
        <span>Fecha de atención</span>
        <input
          class="entrada"
          type="date"
          name="dia"
          [min]="hoy"
          [(ngModel)]="dia"
          (ngModelChange)="cargarHorarios()"
        />
      </label>

      @if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
      @if (sugerencias().length) {
        <aside class="aviso" role="status">
          <strong>Ese horario ya no está disponible.</strong>
          <span>Elige una de estas opciones cercanas:</span>
          <div class="horarios horarios--sugeridos">
            @for (sugerencia of sugerencias(); track sugerencia) {
              <button type="button" class="horario" (click)="elegirSugerencia(sugerencia)">
                {{ sugerencia | date: 'h:mm a' }}
              </button>
            }
          </div>
        </aside>
      }

      @if (cargando()) {
        <p class="texto-suave" aria-live="polite">Buscando horarios…</p>
      } @else {
        <div class="horarios" role="group" aria-label="Horarios disponibles">
          @for (horario of horarios(); track horario.fecha_hora) {
            <button
              type="button"
              class="horario"
              [class.horario--seleccionado]="seleccionado()?.fecha_hora === horario.fecha_hora"
              (click)="seleccionar(horario)"
            >
              {{ horario.fecha_hora | date: 'h:mm a' }}
            </button>
          } @empty {
            <p class="texto-suave">
              No hay horarios disponibles para esa fecha. Prueba otro día hábil.
            </p>
          }
        </div>
      }

      @if (seleccionado()) {
        <section class="tarjeta resumen">
          <h3 class="tarjeta__titulo">Resumen de la solicitud</h3>
          <p>
            {{ seleccionado()?.fecha_hora | date: 'EEEE d MMMM, h:mm a' }} ·
            {{ seleccionado()?.veterinario }}
          </p>
          <button
            class="boton boton--primario"
            type="button"
            [disabled]="enviando()"
            (click)="solicitar()"
          >
            {{ enviando() ? 'Enviando…' : 'Solicitar cita' }}
          </button>
        </section>
      }
      <a class="volver" [routerLink]="rutaServicio">Cambiar servicio</a>
    </main>
  `,
  styles: `
    .paso {
      color: var(--color-primario);
      font-size: var(--texto-meta);
      font-weight: 700;
    }
    .fecha {
      max-width: 360px;
    }
    .horarios {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .horario {
      min-width: 105px;
      min-height: 48px;
      padding: 8px 16px;
      border: 1.5px solid var(--color-borde);
      border-radius: 9px;
      background: white;
      color: var(--color-texto);
      font: inherit;
      cursor: pointer;
    }
    .horario--seleccionado {
      border: 2px solid var(--color-primario);
      background: var(--color-primario-suave);
      color: var(--color-marino);
      font-weight: 700;
    }
    .aviso {
      display: grid;
      gap: 5px;
      padding: 15px 18px;
      border-radius: 10px;
      background: var(--color-advertencia-fondo);
      color: var(--color-advertencia);
    }
    .resumen {
      border-color: var(--color-primario);
    }
    .volver {
      align-self: flex-start;
    }
  `,
})
export default class AgendarHorario {
  private readonly agenda = inject(AgendaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly mascotaId = this.route.snapshot.paramMap.get('mascotaId') ?? '';
  protected readonly servicioId = this.route.snapshot.paramMap.get('servicioId') ?? '';
  protected readonly rutaServicio = `/propietario/agendar/servicio/${this.mascotaId}`;
  protected readonly hoy = fechaLocal(new Date());
  protected dia = this.fechaInicial();
  protected readonly horarios = signal<HorarioDisponible[]>([]);
  protected readonly sugerencias = signal<string[]>([]);
  protected readonly seleccionado = signal<HorarioDisponible | null>(null);
  protected readonly cargando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.cargarHorarios();
  }

  protected cargarHorarios(sugerenciasActualizadas: string[] = []): void {
    if (!this.dia || !this.servicioId) return;
    this.sugerencias.set(sugerenciasActualizadas);
    this.cargando.set(true);
    this.error.set(null);
    this.seleccionado.set(null);
    this.agenda.horarios(this.dia, this.servicioId).subscribe({
      next: (horarios) => {
        this.horarios.set(horarios);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.cargando.set(false);
      },
    });
  }

  protected seleccionar(horario: HorarioDisponible): void {
    this.seleccionado.set(horario);
    this.sugerencias.set([]);
  }

  protected elegirSugerencia(fechaHora: string): void {
    const horario = this.horarios().find(
      (opcion) => new Date(opcion.fecha_hora).getTime() === new Date(fechaHora).getTime(),
    );
    if (horario) this.seleccionar(horario);
  }

  protected solicitar(): void {
    const horario = this.seleccionado();
    if (!horario || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.agenda
      .solicitarCita({
        mascota_id: this.mascotaId,
        servicio_id: this.servicioId,
        fecha_hora: horario.fecha_hora,
        veterinario_id: horario.veterinario_id,
      })
      .subscribe({
        next: (cita) =>
          this.router.navigate(['/propietario/agendar/enviada'], {
            queryParams: {
              mascota: cita.mascota,
              servicio: cita.servicio,
              fecha: cita.fecha_hora,
            },
          }),
        error: (error: unknown) => {
          const respuesta = leerErrorApi(error);
          this.error.set(respuesta.mensaje);
          const sugerencias = respuesta.detalle['horarios_sugeridos'];
          if (respuesta.codigo === 'HORARIO_NO_DISPONIBLE' && Array.isArray(sugerencias)) {
            const opciones = sugerencias.filter((hora): hora is string => typeof hora === 'string');
            this.cargarHorarios(opciones);
          }
          this.enviando.set(false);
        },
      });
  }

  private fechaInicial(): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 1);
    while (fecha.getDay() === 0 || fecha.getDay() === 6) fecha.setDate(fecha.getDate() + 1);
    return fechaLocal(fecha);
  }
}
