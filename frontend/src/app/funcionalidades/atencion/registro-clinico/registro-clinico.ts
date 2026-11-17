import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { TarjetaPaciente } from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { AtencionService } from '../atencion.service';
import { ConsultaDetalle } from '../modelos';

/**
 * M2.6 Registro clínico cerrado (solo lectura). Las correcciones se agregan como nota
 * aclaratoria fechada y firmada, sin tocar el registro original (C4).
 */
@Component({
  selector: 'cv-registro-clinico',
  imports: [DatePipe, DecimalPipe, FormsModule, Aviso, Encabezado, EstadoEtiqueta, TarjetaPaciente],
  template: `
    <cv-encabezado titulo="Historia clínica" [rutaAtras]="rutaFicha()" />
    <main class="contenido">
      @if (consulta(); as consulta) {
        @if (aviso() === 'recien-cerrada') {
          <cv-aviso tipo="exito" titulo="Atención cerrada">
            <p>
              El registro quedó cerrado y ya no puede editarse.
              @if (consulta.vacunaciones.length) {
                Se programó el recordatorio de la próxima dosis.
              }
            </p>
          </cv-aviso>
        } @else if (aviso() === 'cerrado') {
          <cv-aviso tipo="neutro" titulo="Este registro ya está cerrado">
            <p>No puede editarse. Si necesitas corregir algo, agrega una nota aclaratoria.</p>
          </cv-aviso>
        }

        <cv-tarjeta-paciente
          [paciente]="consulta.mascota"
          [variante]="aviso() === 'recien-cerrada' ? 'compacta' : 'completa'"
        />

        <section class="tarjeta" aria-labelledby="titulo-consulta">
          <div class="tarjeta__encabezado">
            <h3 id="titulo-consulta" class="tarjeta__titulo">
              Consulta · {{ consulta.fecha | date: 'dd/MM/yyyy' }}
            </h3>
            <cv-estado-etiqueta tipo="neutro">Cerrado — solo lectura</cv-estado-etiqueta>
          </div>
          <div class="fila-campos">
            <div class="campo">
              <span class="campo__etiqueta" id="et-motivo">Motivo</span>
              <p class="entrada entrada--solo-lectura" aria-labelledby="et-motivo">
                {{ consulta.motivo || '—' }}
              </p>
            </div>
            <div class="campo">
              <span class="campo__etiqueta" id="et-diagnostico">Diagnóstico</span>
              <p class="entrada entrada--solo-lectura" aria-labelledby="et-diagnostico">
                {{ consulta.diagnostico || '—' }}
              </p>
            </div>
            <div class="campo">
              <span class="campo__etiqueta" id="et-tratamiento">Tratamiento</span>
              <p class="entrada entrada--solo-lectura" aria-labelledby="et-tratamiento">
                {{ consulta.plan_tratamiento || '—' }}
              </p>
            </div>
          </div>
          <dl class="detalle">
            <div>
              <dt>Signos vitales</dt>
              <dd>
                {{
                  consulta.peso !== null
                    ? (consulta.peso | number: '1.0-2') + ' kg'
                    : 'Peso sin registrar'
                }}
                ·
                {{
                  consulta.temperatura !== null
                    ? (consulta.temperatura | number: '1.0-1') + ' °C'
                    : 'Temperatura sin registrar'
                }}
                ·
                {{
                  consulta.frecuencia_cardiaca !== null
                    ? consulta.frecuencia_cardiaca + ' lpm'
                    : 'Frecuencia sin registrar'
                }}
              </dd>
            </div>
            @if (consulta.hallazgos) {
              <div>
                <dt>Hallazgos</dt>
                <dd>{{ consulta.hallazgos }}</dd>
              </div>
            }
            @for (vacuna of consulta.vacunaciones; track vacuna.id) {
              <div>
                <dt>Vacuna</dt>
                <dd>
                  {{ vacuna.biologico }} · lote {{ vacuna.lote_codigo }}
                  @if (vacuna.fecha_proxima_dosis) {
                    · próxima dosis {{ vacuna.fecha_proxima_dosis | date: 'dd/MM/yyyy' }}
                  }
                </dd>
              </div>
            }
            @for (item of consulta.prescripciones; track item.id) {
              <div>
                <dt>Prescripción</dt>
                <dd>
                  {{ item.producto }} × {{ item.cantidad
                  }}{{ item.dosis ? ' · ' + item.dosis : '' }}
                </dd>
              </div>
            }
            <div>
              <dt>Atendió</dt>
              <dd>{{ consulta.veterinario }}</dd>
            </div>
          </dl>
        </section>

        @if (consulta.notas.length) {
          <section class="tarjeta" aria-labelledby="titulo-notas">
            <h3 id="titulo-notas" class="tarjeta__titulo">Notas aclaratorias</h3>
            @for (nota of consulta.notas; track nota.id) {
              <article class="nota">
                <p>{{ nota.texto }}</p>
                <p class="texto-suave nota__firma">
                  {{ nota.autor }} · {{ nota.fecha | date: 'dd/MM/yyyy HH:mm' }}
                </p>
              </article>
            }
          </section>
        }

        @if (escribiendoNota()) {
          <form class="tarjeta" (ngSubmit)="guardarNota()">
            <h3 class="tarjeta__titulo">Agregar nota aclaratoria</h3>
            <p class="texto-suave">
              El registro original no se modifica ni se elimina. La nota queda fechada y firmada con
              tu usuario.
            </p>
            <div class="campo">
              <label for="nota">Nota aclaratoria (obligatoria)</label>
              <textarea
                id="nota"
                name="nota"
                class="entrada entrada--destacada"
                rows="3"
                placeholder="Escribe la corrección o aclaración…"
                required
                [(ngModel)]="textoNota"
              ></textarea>
            </div>
            @if (errorNota()) {
              <p class="ayuda-error" role="alert">{{ errorNota() }}</p>
            }
            <div class="acciones">
              <button
                type="submit"
                class="boton boton--primario"
                [disabled]="textoNota.trim().length < 3 || guardandoNota()"
              >
                Guardar nota aclaratoria
              </button>
              <button type="button" class="boton boton--secundario" (click)="cancelarNota()">
                Cancelar
              </button>
            </div>
          </form>
        } @else {
          <div class="acciones">
            @if (consulta.factura; as factura) {
              <button type="button" class="boton boton--primario" (click)="irAFacturacion()">
                Ver comprobante {{ factura.numero }}
              </button>
            } @else {
              <button type="button" class="boton boton--primario" (click)="irAFacturacion()">
                Facturar atención
              </button>
            }
            @if (puedeEscribir()) {
              <button
                type="button"
                class="boton boton--secundario"
                (click)="escribiendoNota.set(true)"
              >
                Agregar nota aclaratoria
              </button>
            }
          </div>
        }
      } @else if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .campo__etiqueta {
      font-size: var(--texto-etiqueta);
      font-weight: 500;
    }
    p.entrada {
      margin: 0;
      padding-block: 10px;
    }
    .detalle {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
      font-size: var(--texto-meta);
      div {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      dt {
        font-weight: 600;
        &::after {
          content: ':';
        }
      }
      dd {
        margin: 0;
        color: var(--color-texto-suave);
      }
    }
    .nota {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .nota + .nota {
      padding-top: 11px;
      border-top: 1px solid var(--color-borde);
    }
    .nota__firma {
      font-size: var(--texto-meta);
    }
  `,
})
export default class RegistroClinico {
  /** Llega desde la ruta /personal/consultas/:consultaId/registro. */
  readonly consultaId = input.required<string>();
  /** Parámetro ?aviso= con el que se llega: recién cerrada o intento de editar un cerrado. */
  readonly aviso = input<string | undefined>();

  private readonly atencion = inject(AtencionService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected readonly consulta = signal<ConsultaDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly escribiendoNota = signal(false);
  protected readonly guardandoNota = signal(false);
  protected readonly errorNota = signal<string | null>(null);
  protected readonly rutaFicha = signal('/personal/pacientes');
  protected readonly puedeEscribir = computed(() => this.sesion.usuario()?.rol === 'VETERINARIO');
  protected textoNota = '';

  constructor() {
    effect(() => this.cargar(this.consultaId()));
    effect(() => {
      if (this.aviso() === 'cerrado' && this.puedeEscribir()) {
        this.escribiendoNota.set(true);
      }
    });
  }

  protected guardarNota(): void {
    this.guardandoNota.set(true);
    this.errorNota.set(null);
    this.atencion.agregarNota(this.consultaId(), this.textoNota).subscribe({
      next: (nota) => {
        this.consulta.update((c) => (c ? { ...c, notas: [...c.notas, nota] } : c));
        this.cancelarNota();
      },
      error: (error: unknown) => {
        this.errorNota.set(leerErrorApi(error).mensaje);
        this.guardandoNota.set(false);
      },
    });
  }

  protected cancelarNota(): void {
    this.textoNota = '';
    this.guardandoNota.set(false);
    this.escribiendoNota.set(false);
  }

  protected irAFacturacion(): void {
    this.router.navigate(['/personal/facturacion', this.consultaId()]);
  }

  private cargar(idConsulta: string): void {
    this.atencion.consulta(idConsulta).subscribe({
      next: (consulta) => {
        if (consulta.estado === 'ABIERTA') {
          this.router.navigate(['/personal/consultas', idConsulta], { replaceUrl: true });
          return;
        }
        this.consulta.set(consulta);
        this.rutaFicha.set(`/personal/pacientes/${consulta.mascota.id}`);
      },
      error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
    });
  }
}
