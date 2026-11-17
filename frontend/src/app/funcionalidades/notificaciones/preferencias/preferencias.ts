import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { environment } from '../../../../environments/environment';
import { leerErrorApi } from '../../../core/api/error-api';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';

interface Preferencias {
  canal: 'CORREO' | 'MENSAJERIA';
  recibir_recordatorios: boolean;
  recordatorio_citas: boolean;
  promociones: boolean;
  hora_preferida: string;
}

const PREDETERMINADAS: Preferencias = {
  canal: 'CORREO',
  recibir_recordatorios: true,
  recordatorio_citas: true,
  promociones: false,
  hora_preferida: '09:00',
};

/** M4.2 Preferencias de notificación. Apagar los recordatorios de vacunación muestra E2. */
@Component({
  selector: 'cv-preferencias-notificacion',
  imports: [FormsModule, Aviso, Encabezado],
  template: `
    <cv-encabezado titulo="Mis notificaciones" rutaAtras="/propietario" />
    <main class="contenido">
      <h2 class="titulo-pagina">Preferencias de notificación</h2>
      @if (!cargando() && !preferencias.recibir_recordatorios) {
        <cv-aviso
          tipo="advertencia"
          titulo="Recordatorios de vacunación desactivados"
          icono="iconos/advertencia-ambar.svg"
        >
          <p>
            No recibirás avisos antes de la próxima dosis de tus mascotas. Puedes volver a
            activarlos cuando quieras.
          </p>
        </cv-aviso>
      }
      @if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
      @if (guardado()) {
        <cv-aviso tipo="exito" titulo="Preferencias guardadas">
          <p>Tus preferencias se guardaron.</p>
        </cv-aviso>
      }
      @if (cargando()) {
        <p class="texto-suave">Cargando preferencias…</p>
      } @else {
        <form class="tarjeta" (ngSubmit)="guardar()">
          @for (opcion of interruptores; track opcion.campo) {
            <label class="interruptor">
              <span class="interruptor__texto">
                <strong>{{ opcion.titulo }}</strong>
                <small>{{ opcion.detalle }}</small>
              </span>
              <span class="interruptor__control">
                <input
                  type="checkbox"
                  role="switch"
                  [name]="opcion.campo"
                  [(ngModel)]="preferencias[opcion.campo]"
                  (ngModelChange)="guardado.set(false)"
                />
                <span>{{ preferencias[opcion.campo] ? 'Activado' : 'Desactivado' }}</span>
              </span>
            </label>
          }
          <fieldset class="grupo">
            <legend>Canal preferido</legend>
            <div class="pildoras">
              <label class="pildora">
                <input type="radio" name="canal" value="CORREO" [(ngModel)]="preferencias.canal" />
                Correo electrónico
              </label>
              <label class="pildora">
                <input
                  type="radio"
                  name="canal"
                  value="MENSAJERIA"
                  [(ngModel)]="preferencias.canal"
                />
                Mensajería
              </label>
            </div>
          </fieldset>
          <div class="campo hora">
            <label for="hora">Horario preferido para recibir avisos</label>
            <input
              id="hora"
              class="entrada"
              type="time"
              name="hora"
              [(ngModel)]="preferencias.hora_preferida"
            />
          </div>
        </form>
        <div class="acciones">
          <button
            class="boton boton--primario"
            type="button"
            [disabled]="guardando()"
            (click)="guardar()"
          >
            {{ guardando() ? 'Guardando…' : 'Guardar preferencias' }}
          </button>
        </div>
      }
    </main>
  `,
  styles: `
    .interruptor {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--color-borde);
      cursor: pointer;
    }
    .interruptor__texto {
      display: flex;
      flex-direction: column;
      gap: 2px;
      strong {
        color: var(--color-marino);
        font-size: var(--texto-cuerpo);
        font-weight: 600;
      }
      small {
        color: var(--color-texto-suave);
        font-size: var(--texto-meta);
      }
    }
    .interruptor__control {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 150px;
      color: var(--color-texto-suave);
      font-size: var(--texto-meta);
      font-weight: 500;
      input {
        position: relative;
        width: 46px;
        height: 26px;
        margin: 0;
        background: var(--color-texto-suave);
        border-radius: 999px;
        cursor: pointer;
        appearance: none;
        transition: background 0.15s;
        &::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.15s;
        }
        &:checked {
          background: var(--color-primario);
        }
        &:checked::after {
          transform: translateX(20px);
        }
        &:focus-visible {
          outline: 3px solid var(--color-primario-suave);
        }
      }
    }
    .grupo {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      border: 0;
      legend {
        margin-bottom: 10px;
        font-size: var(--texto-etiqueta);
        font-weight: 500;
      }
    }
    .hora .entrada {
      max-width: 260px;
    }
  `,
})
export default class PreferenciasNotificacion {
  private readonly http = inject(HttpClient);
  protected preferencias = { ...PREDETERMINADAS };
  protected readonly interruptores: {
    campo: 'recibir_recordatorios' | 'recordatorio_citas' | 'promociones';
    titulo: string;
    detalle: string;
  }[] = [
    {
      campo: 'recibir_recordatorios',
      titulo: 'Recordatorios de vacunación y desparasitación',
      detalle: 'Te avisamos 7 días antes de la próxima dosis.',
    },
    {
      campo: 'recordatorio_citas',
      titulo: 'Recordatorio de cita',
      detalle: 'Te avisamos 24 horas antes de tu cita.',
    },
    {
      campo: 'promociones',
      titulo: 'Promociones y novedades',
      detalle: 'Ofertas y noticias de la clínica.',
    },
  ];
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.http.get<Preferencias>(`${environment.apiUrl}/notificaciones/preferencias`).subscribe({
      next: (preferencias) => {
        this.preferencias = {
          ...preferencias,
          hora_preferida: preferencias.hora_preferida.slice(0, 5),
        };
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.cargando.set(false);
      },
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.guardado.set(false);
    this.error.set(null);
    this.http
      .put<Preferencias>(`${environment.apiUrl}/notificaciones/preferencias`, this.preferencias)
      .subscribe({
        next: (preferencias) => {
          this.preferencias = {
            ...preferencias,
            hora_preferida: preferencias.hora_preferida.slice(0, 5),
          };
          this.guardado.set(true);
          this.guardando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(leerErrorApi(error).mensaje);
          this.guardando.set(false);
        },
      });
  }
}
