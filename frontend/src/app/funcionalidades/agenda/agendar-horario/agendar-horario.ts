import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { AgendaService } from '../agenda.service';
import { HorarioDisponible, MascotaAgendada, ServicioAgendado } from '../agenda.modelos';

function fechaLocal(valor: Date): string {
  const zona = valor.getTimezoneOffset() * 60_000;
  return new Date(valor.getTime() - zona).toISOString().slice(0, 10);
}

function mismaHora(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

/** M1.2 Elegir fecha y hora. Si el horario se ocupa al solicitar, muestra B1 con sugerencias. */
@Component({
  selector: 'cv-agendar-horario',
  imports: [DatePipe, FormsModule, Aviso, Encabezado, EstadoEtiqueta],
  template: `
    <cv-encabezado titulo="Agendar cita" [rutaAtras]="rutaServicio" />
    <main class="contenido">
      <h2 class="titulo-pagina">Elige fecha y hora</h2>
      <div class="chips">
        @if (mascota(); as mascota) {
          <span class="chip">Mascota: {{ mascota.nombre }} · {{ mascota.especie }}</span>
        }
        @if (servicio(); as servicio) {
          <span class="chip">Servicio: {{ servicio.nombre }}</span>
        }
      </div>

      @if (rechazado(); as rechazado) {
        <cv-aviso
          tipo="advertencia"
          titulo="Ese horario ya no está disponible"
          icono="iconos/reloj.svg"
        >
          <p>
            El horario de las {{ rechazado | date: 'HH:mm' }} del
            {{ rechazado | date: 'EEEE dd/MM/yyyy' }} acaba de ocuparse. Elige otro horario
            disponible; conservamos tu mascota y tu servicio.
          </p>
        </cv-aviso>
      }

      <div class="dia">
        <h3 class="dia__titulo">{{ diaComoFecha() | date: 'EEEE dd/MM/yyyy' }}</h3>
        <label class="dia__selector">
          <span class="solo-lectores">Fecha de atención</span>
          <input
            class="entrada"
            type="date"
            name="dia"
            [min]="hoy"
            [(ngModel)]="dia"
            (ngModelChange)="cambiarDia()"
          />
        </label>
      </div>
      @if (error() && !rechazado()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }

      @if (cargando()) {
        <p class="texto-suave" aria-live="polite">Buscando horarios…</p>
      } @else {
        <div class="horarios" role="group" aria-label="Horarios del día">
          @for (horario of horarios(); track horario.fecha_hora) {
            @let estado = estadoDe(horario);
            <button
              type="button"
              class="horario"
              [class.horario--ocupado]="estado === 'Ocupado'"
              [class.horario--elegido]="estado === 'Seleccionado' || estado === 'Sugerido'"
              [disabled]="estado === 'Ocupado'"
              (click)="seleccionado.set(horario)"
            >
              <strong>{{ horario.fecha_hora | date: 'HH:mm' }}</strong>
              <small>
                <img
                  [src]="estado === 'Ocupado' ? 'iconos/candado.svg' : 'iconos/check.svg'"
                  alt=""
                  width="13"
                  height="13"
                />
                {{ estado }}
              </small>
            </button>
          } @empty {
            <p class="texto-suave">No hay horarios para esa fecha. Prueba otro día hábil.</p>
          }
        </div>
      }

      <p class="pendiente">
        <cv-estado-etiqueta tipo="info" icono="iconos/reloj-arena.svg" tamano="pequeno">
          Pendiente de confirmar
        </cv-estado-etiqueta>
        Tu solicitud queda pendiente hasta que la clínica la confirme.
      </p>

      <div class="acciones">
        <button
          class="boton boton--primario"
          type="button"
          [disabled]="!seleccionado() || enviando()"
          (click)="solicitar()"
        >
          @if (enviando()) {
            Enviando…
          } @else if (rechazado() && seleccionado()) {
            Solicitar las {{ seleccionado()?.fecha_hora | date: 'HH:mm' }}
          } @else {
            Solicitar cita
          }
        </button>
        <button class="boton boton--secundario" type="button" (click)="cambiarServicio()">
          Cambiar de servicio
        </button>
      </div>
    </main>
  `,
  styles: `
    .dia {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .dia__titulo {
      color: var(--color-marino);
      font-size: var(--texto-destacado);
      font-weight: 600;
      &::first-letter {
        text-transform: uppercase;
      }
    }
    .dia__selector .entrada {
      width: auto;
      min-width: 190px;
    }
    .horarios {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .horario {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 10px 6px;
      color: var(--color-marino);
      font: inherit;
      background: var(--color-superficie);
      border: 2px solid var(--color-primario);
      border-radius: 10px;
      cursor: pointer;
      strong {
        font-size: var(--texto-destacado);
      }
      small {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
      }
    }
    .horario--ocupado {
      color: var(--color-texto-suave);
      background: var(--color-neutro-fondo);
      border-color: var(--color-borde);
      cursor: not-allowed;
    }
    .horario--elegido {
      color: #fff;
      background: var(--color-primario);
      img {
        filter: brightness(0) invert(1);
      }
    }
    .pendiente {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      color: var(--color-texto-suave);
      font-size: var(--texto-meta);
    }
    @media (max-width: 640px) {
      .horarios {
        grid-template-columns: repeat(2, 1fr);
      }
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
  protected readonly diaElegido = signal(this.dia);
  protected readonly diaComoFecha = computed(() => new Date(`${this.diaElegido()}T12:00:00`));
  protected readonly horarios = signal<HorarioDisponible[]>([]);
  protected readonly sugerencias = signal<string[]>([]);
  protected readonly rechazado = signal<string | null>(null);
  protected readonly seleccionado = signal<HorarioDisponible | null>(null);
  protected readonly cargando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Solo cuenta la respuesta de la última consulta de horarios (al cambiar de día rápido). */
  private consultaActual = 0;
  protected readonly mascotas = signal<MascotaAgendada[]>([]);
  protected readonly servicios = signal<ServicioAgendado[]>([]);
  protected readonly mascota = computed(
    () => this.mascotas().find((mascota) => mascota.id === this.mascotaId) ?? null,
  );
  protected readonly servicio = computed(
    () => this.servicios().find((servicio) => servicio.id === this.servicioId) ?? null,
  );

  constructor() {
    this.agenda.mascotas().subscribe({ next: (mascotas) => this.mascotas.set(mascotas) });
    this.agenda.servicios().subscribe({ next: (servicios) => this.servicios.set(servicios) });
    this.cargarHorarios();
  }

  protected estadoDe(horario: HorarioDisponible): string {
    const rechazado = this.rechazado();
    if (!horario.disponible || (rechazado && mismaHora(horario.fecha_hora, rechazado))) {
      return 'Ocupado';
    }
    const elegido = this.seleccionado();
    if (elegido && mismaHora(elegido.fecha_hora, horario.fecha_hora)) {
      return this.sugerencias().some((hora) => mismaHora(hora, horario.fecha_hora))
        ? 'Sugerido'
        : 'Seleccionado';
    }
    return 'Disponible';
  }

  protected cambiarDia(): void {
    this.diaElegido.set(this.dia);
    this.rechazado.set(null);
    this.sugerencias.set([]);
    this.cargarHorarios();
  }

  protected cambiarServicio(): void {
    this.router.navigate([this.rutaServicio]);
  }

  protected solicitar(): void {
    const horario = this.seleccionado();
    if (!horario?.veterinario_id || this.enviando()) return;
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
              mascotaId: this.mascotaId,
              mascota: cita.mascota,
              especie: this.mascota()?.especie ?? '',
              servicio: cita.servicio,
              fecha: cita.fecha_hora,
            },
          }),
        error: (error: unknown) => {
          const respuesta = leerErrorApi(error);
          this.enviando.set(false);
          const sugerencias = respuesta.detalle['horarios_sugeridos'];
          if (respuesta.codigo === 'HORARIO_NO_DISPONIBLE' && Array.isArray(sugerencias)) {
            this.rechazado.set(horario.fecha_hora);
            this.cargarHorarios(
              sugerencias.filter((hora): hora is string => typeof hora === 'string'),
            );
          } else {
            this.error.set(respuesta.mensaje);
          }
        },
      });
  }

  private cargarHorarios(sugerencias: string[] = []): void {
    if (!this.dia || !this.servicioId) return;
    this.sugerencias.set(sugerencias);
    this.cargando.set(true);
    this.error.set(null);
    this.seleccionado.set(null);
    const consulta = ++this.consultaActual;
    this.agenda.horarios(this.dia, this.servicioId).subscribe({
      next: (horarios) => {
        if (consulta !== this.consultaActual) return;
        this.horarios.set(horarios);
        // B1: se preselecciona el horario sugerido más cercano.
        const cercano = sugerencias[0];
        const sugerido = cercano
          ? horarios.find((horario) => horario.disponible && mismaHora(cercano, horario.fecha_hora))
          : undefined;
        this.seleccionado.set(sugerido ?? null);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        if (consulta !== this.consultaActual) return;
        this.error.set(leerErrorApi(error).mensaje);
        this.cargando.set(false);
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
