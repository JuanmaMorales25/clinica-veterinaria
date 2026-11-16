import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { EstadoEtiqueta } from '../estado-etiqueta/estado-etiqueta';

/** Datos mínimos para identificar al paciente en la parte superior de cada pantalla. */
export interface DatosTarjetaPaciente {
  nombre: string;
  especie: string;
  edad: string | null;
  numero_historia: string;
  fotografia: string | null;
  alergias?: { descripcion: string }[];
  esquema_al_dia?: boolean;
  ultima_atencion?: string | null;
}

/**
 * Ficha del paciente. La variante completa muestra alergias y esquema (M2.2–M2.4); la compacta
 * solo identifica al paciente (M2.5 en adelante).
 */
@Component({
  selector: 'cv-tarjeta-paciente',
  imports: [DatePipe, EstadoEtiqueta],
  template: `
    <section [class]="'paciente paciente--' + variante()" aria-label="Paciente">
      @if (paciente().fotografia; as foto) {
        <img class="paciente__foto" [src]="foto" alt="Foto de {{ paciente().nombre }}" />
      } @else {
        <div class="paciente__foto paciente__foto--vacia" aria-hidden="true"></div>
      }
      <div class="paciente__datos">
        <h2 class="paciente__nombre">{{ paciente().nombre }}</h2>
        <p class="paciente__detalle">{{ subtitulo() ?? descripcion() }}</p>
        @if (variante() === 'completa') {
          <div class="paciente__estados">
            @for (alergia of paciente().alergias ?? []; track alergia.descripcion) {
              <cv-estado-etiqueta tipo="alerta"
                >ALERGIA: {{ alergia.descripcion }}</cv-estado-etiqueta
              >
            }
            @if (paciente().esquema_al_dia) {
              <cv-estado-etiqueta tipo="exito">Esquema al día</cv-estado-etiqueta>
            } @else {
              <cv-estado-etiqueta tipo="advertencia">Vacuna pendiente</cv-estado-etiqueta>
            }
          </div>
          <p class="paciente__meta">
            Última atención:
            {{
              paciente().ultima_atencion
                ? (paciente().ultima_atencion | date: 'dd/MM/yyyy')
                : 'sin registros'
            }}
          </p>
        }
      </div>
    </section>
  `,
  styles: `
    .paciente {
      display: flex;
      align-items: center;
      gap: 19px;
      padding: 16px;
      background: var(--color-superficie);
      border: 1.5px solid var(--color-borde);
      border-radius: 14px;
    }
    .paciente__foto {
      flex-shrink: 0;
      width: 95px;
      height: 95px;
      border-radius: 12px;
      object-fit: cover;
    }
    .paciente--compacta .paciente__foto {
      width: 60px;
      height: 60px;
    }
    .paciente__foto--vacia {
      background: var(--color-primario-suave);
    }
    .paciente__datos {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-width: 0;
    }
    .paciente__nombre {
      color: var(--color-marino);
      font-size: var(--texto-titulo);
      font-weight: 700;
    }
    .paciente--compacta .paciente__nombre {
      font-size: 23px;
    }
    .paciente__detalle {
      color: var(--color-texto-suave);
      font-size: var(--texto-cuerpo);
    }
    .paciente__estados {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .paciente__meta {
      color: var(--color-texto-suave);
      font-size: var(--texto-meta);
    }
    @media (max-width: 640px) {
      .paciente {
        align-items: flex-start;
      }
      .paciente__foto {
        width: 64px;
        height: 64px;
      }
    }
  `,
})
export class TarjetaPaciente {
  readonly paciente = input.required<DatosTarjetaPaciente>();
  readonly variante = input<'completa' | 'compacta'>('completa');
  /** Reemplaza la línea "Perro · 6 meses · Historia HC-00481" (por ejemplo, en facturación). */
  readonly subtitulo = input<string | null>(null);

  protected descripcion(): string {
    const { especie, edad, numero_historia } = this.paciente();
    return [especie, edad, `Historia ${numero_historia}`].filter(Boolean).join(' · ');
  }
}
