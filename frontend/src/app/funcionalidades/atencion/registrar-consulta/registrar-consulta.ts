import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';

import { leerErrorApi } from '../../../core/api/error-api';
import { escucharTeclaDemo } from '../../../core/demo/demo.service';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { TarjetaPaciente } from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { AtencionService } from '../atencion.service';
import { aNumero, aTexto } from '../formato';
import { ConsultaDetalle, DatosConsulta, Prescripcion } from '../modelos';

interface Formulario {
  motivo: string;
  peso: string;
  temperatura: string;
  frecuencia_cardiaca: string;
  hallazgos: string;
  diagnostico: string;
  plan_tratamiento: string;
}

interface BorradorLocal {
  datos: Formulario;
  hora: string;
}

const ESPERA_AUTOGUARDADO_MS = 1500;
const CAMPOS_NUMERICOS = ['peso', 'temperatura', 'frecuencia_cardiaca'] as const;

function claveBorrador(idConsulta: string): string {
  return `cv.borrador.consulta.${idConsulta}`;
}

function leerBorrador(idConsulta: string): BorradorLocal | null {
  try {
    return JSON.parse(localStorage.getItem(claveBorrador(idConsulta)) ?? 'null');
  } catch {
    return null;
  }
}

function escribirBorrador(idConsulta: string, borrador: BorradorLocal | null): void {
  try {
    if (borrador) {
      localStorage.setItem(claveBorrador(idConsulta), JSON.stringify(borrador));
    } else {
      localStorage.removeItem(claveBorrador(idConsulta));
    }
  } catch {
    // Sin almacenamiento local solo se pierde la recuperación del borrador.
  }
}

function desdeConsulta(consulta: ConsultaDetalle): Formulario {
  return {
    motivo: consulta.motivo ?? '',
    peso: aTexto(consulta.peso),
    temperatura: aTexto(consulta.temperatura),
    frecuencia_cardiaca: aTexto(consulta.frecuencia_cardiaca),
    hallazgos: consulta.hallazgos ?? '',
    diagnostico: consulta.diagnostico ?? '',
    plan_tratamiento: consulta.plan_tratamiento ?? '',
  };
}

function iguales(a: Formulario, b: Formulario): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** M2.3 Registrar consulta, con recuperación del borrador si se pierde la conexión (C3). */
@Component({
  selector: 'cv-registrar-consulta',
  imports: [DatePipe, FormsModule, Aviso, Encabezado, EstadoEtiqueta, TarjetaPaciente],
  template: `
    <cv-encabezado titulo="Registrar consulta" [rutaAtras]="rutaFicha()" />
    <main class="contenido">
      @if (consulta(); as consulta) {
        <cv-tarjeta-paciente [paciente]="consulta.mascota" />

        @if (borrador(); as borrador) {
          <cv-aviso
            tipo="advertencia"
            icono="iconos/reloj.svg"
            titulo="Conexión perdida — borrador recuperado"
          >
            <p>
              Se perdió la conexión a las {{ borrador.hora | date: 'HH:mm' }}. Recuperamos el
              contenido parcial de esta consulta; revísalo antes de continuar.
            </p>
          </cv-aviso>
        }

        <form class="tarjeta" (ngSubmit)="irA('vacunacion')">
          <div class="tarjeta__encabezado">
            <h3 class="tarjeta__titulo">Consulta</h3>
            @if (borrador()) {
              <cv-estado-etiqueta tipo="info">Borrador sin guardar</cv-estado-etiqueta>
            }
          </div>

          <div class="campo">
            <label for="motivo">Motivo de consulta</label>
            <input
              id="motivo"
              name="motivo"
              class="entrada"
              maxlength="255"
              [ngModel]="formulario().motivo"
              (ngModelChange)="cambiar('motivo', $event)"
            />
          </div>

          <div class="fila-campos">
            <div class="campo">
              <label for="peso">Peso (kg)</label>
              <input
                id="peso"
                name="peso"
                class="entrada"
                inputmode="decimal"
                placeholder="Sin registrar"
                [attr.aria-invalid]="invalido('peso')"
                [ngModel]="formulario().peso"
                (ngModelChange)="cambiar('peso', $event)"
              />
            </div>
            <div class="campo">
              <label for="temperatura">Temperatura (°C)</label>
              <input
                id="temperatura"
                name="temperatura"
                class="entrada"
                inputmode="decimal"
                placeholder="Sin registrar"
                [attr.aria-invalid]="invalido('temperatura')"
                [ngModel]="formulario().temperatura"
                (ngModelChange)="cambiar('temperatura', $event)"
              />
            </div>
            <div class="campo">
              <label for="frecuencia">Frecuencia cardíaca (lpm)</label>
              <input
                id="frecuencia"
                name="frecuencia"
                class="entrada"
                inputmode="numeric"
                placeholder="Sin registrar"
                [attr.aria-invalid]="invalido('frecuencia_cardiaca')"
                [ngModel]="formulario().frecuencia_cardiaca"
                (ngModelChange)="cambiar('frecuencia_cardiaca', $event)"
              />
            </div>
          </div>
          @if (hayNumerosInvalidos()) {
            <p class="ayuda-error">
              Escribe peso, temperatura y frecuencia solo con números (12,4).
            </p>
          }

          <div class="campo">
            <label for="hallazgos">Hallazgos del examen físico</label>
            <textarea
              id="hallazgos"
              name="hallazgos"
              class="entrada"
              rows="3"
              [ngModel]="formulario().hallazgos"
              (ngModelChange)="cambiar('hallazgos', $event)"
            ></textarea>
          </div>

          <div class="fila-campos">
            <div class="campo">
              <label for="diagnostico">Diagnóstico</label>
              <input
                id="diagnostico"
                name="diagnostico"
                class="entrada"
                [ngModel]="formulario().diagnostico"
                (ngModelChange)="cambiar('diagnostico', $event)"
              />
            </div>
            <div class="campo">
              <label for="plan">Plan de tratamiento</label>
              <input
                id="plan"
                name="plan"
                class="entrada"
                [ngModel]="formulario().plan_tratamiento"
                (ngModelChange)="cambiar('plan_tratamiento', $event)"
              />
            </div>
          </div>
          <p class="texto-suave estado-guardado" aria-live="polite">{{ estadoGuardado() }}</p>
        </form>

        @if (consulta.prescripciones.length) {
          <section class="tarjeta" aria-labelledby="titulo-prescripciones">
            <h3 id="titulo-prescripciones" class="tarjeta__titulo">Prescripciones</h3>
            <ul class="lista">
              @for (item of consulta.prescripciones; track item.id) {
                <li class="lista__item">
                  <div>
                    <p class="lista__principal">{{ item.producto }} × {{ item.cantidad }}</p>
                    <p class="texto-suave">{{ indicaciones(item) }}</p>
                  </div>
                  <button type="button" class="boton boton--secundario" (click)="quitar(item.id)">
                    Quitar
                  </button>
                </li>
              }
            </ul>
          </section>
        }

        @if (error()) {
          <p class="ayuda-error" role="alert">{{ error() }}</p>
        }

        <div class="acciones">
          @if (borrador()) {
            <button type="button" class="boton boton--primario" (click)="continuarRegistrando()">
              Continuar registrando
            </button>
            <button type="button" class="boton boton--secundario" (click)="descartarBorrador()">
              Descartar borrador
            </button>
          } @else {
            <button
              type="button"
              class="boton boton--primario"
              [disabled]="guardando()"
              (click)="irA('vacunacion')"
            >
              Siguiente: vacunación
            </button>
            <button
              type="button"
              class="boton boton--secundario"
              [disabled]="guardando()"
              (click)="irA('prescripcion')"
            >
              Prescribir medicamento
            </button>
          }
        </div>
      } @else if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .estado-guardado {
      min-height: 1.4em;
      font-size: var(--texto-meta);
    }
    .lista {
      display: flex;
      flex-direction: column;
      gap: 11px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .lista__item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 11px;
    }
    .lista__item + .lista__item {
      padding-top: 11px;
      border-top: 1px solid var(--color-borde);
    }
    .lista__principal {
      font-weight: 500;
    }
  `,
})
export default class RegistrarConsulta {
  /** Llega desde la ruta /personal/consultas/:consultaId. */
  readonly consultaId = input.required<string>();

  private readonly atencion = inject(AtencionService);
  private readonly router = inject(Router);

  protected readonly consulta = signal<ConsultaDetalle | null>(null);
  protected readonly formulario = signal<Formulario>(desdeConsulta({} as ConsultaDetalle));
  protected readonly borrador = signal<BorradorLocal | null>(null);
  protected readonly guardando = signal(false);
  protected readonly estadoGuardado = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly rutaFicha = signal('/personal/pacientes');

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => this.cargar(this.consultaId()));
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
    // Tecla 3: simula que se cae la conexión con cambios sin guardar (C3).
    escucharTeclaDemo('3', () => this.perderConexion());
  }

  protected cambiar(campo: keyof Formulario, valor: string): void {
    this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
    this.estadoGuardado.set('');
    escribirBorrador(this.consultaId(), {
      datos: this.formulario(),
      hora: this.borrador()?.hora ?? new Date().toISOString(),
    });
    if (!this.borrador()) {
      clearTimeout(this.temporizador);
      this.temporizador = setTimeout(() => this.guardar().subscribe(), ESPERA_AUTOGUARDADO_MS);
    }
  }

  protected invalido(campo: (typeof CAMPOS_NUMERICOS)[number]): boolean {
    const texto = this.formulario()[campo];
    return texto.trim() !== '' && aNumero(texto) === null;
  }

  protected hayNumerosInvalidos(): boolean {
    return CAMPOS_NUMERICOS.some((campo) => this.invalido(campo));
  }

  protected indicaciones(item: Prescripcion): string {
    return [item.dosis, item.via_administracion, item.frecuencia, item.duracion]
      .filter(Boolean)
      .join(' · ');
  }

  protected irA(paso: 'vacunacion' | 'prescripcion'): void {
    clearTimeout(this.temporizador);
    this.guardar().subscribe((ok) => {
      if (ok) {
        this.router.navigate(['/personal/consultas', this.consultaId(), paso]);
      }
    });
  }

  protected continuarRegistrando(): void {
    this.borrador.set(null);
    this.guardar().subscribe();
  }

  protected descartarBorrador(): void {
    escribirBorrador(this.consultaId(), null);
    this.borrador.set(null);
    const consulta = this.consulta();
    if (consulta) {
      this.formulario.set(desdeConsulta(consulta));
    }
  }

  protected quitar(idItem: string): void {
    this.atencion.quitarPrescripcion(this.consultaId(), idItem).subscribe({
      next: () => this.cargar(this.consultaId()),
      error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
    });
  }

  private cargar(idConsulta: string): void {
    this.atencion.consulta(idConsulta).subscribe({
      next: (consulta) => {
        if (consulta.estado === 'CERRADA') {
          this.irAlRegistroCerrado();
          return;
        }
        this.consulta.set(consulta);
        this.rutaFicha.set(`/personal/pacientes/${consulta.mascota.id}`);
        const delServidor = desdeConsulta(consulta);
        const local = leerBorrador(idConsulta);
        if (local && !iguales(local.datos, delServidor)) {
          // Quedaron cambios sin guardar de una sesión anterior: se ofrecen antes de seguir.
          this.formulario.set(local.datos);
          this.borrador.set(local);
        } else {
          escribirBorrador(idConsulta, null);
          this.formulario.set(delServidor);
        }
      },
      error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
    });
  }

  private guardar(): Observable<boolean> {
    if (this.hayNumerosInvalidos()) {
      return of(false);
    }
    const datos = this.formulario();
    const cuerpo: DatosConsulta = {
      motivo: datos.motivo,
      peso: aNumero(datos.peso),
      temperatura: aNumero(datos.temperatura),
      frecuencia_cardiaca: aNumero(datos.frecuencia_cardiaca),
      hallazgos: datos.hallazgos || null,
      diagnostico: datos.diagnostico || null,
      plan_tratamiento: datos.plan_tratamiento || null,
    };
    this.guardando.set(true);
    this.error.set(null);
    return new Observable<boolean>((suscriptor) => {
      this.atencion.guardarConsulta(this.consultaId(), cuerpo).subscribe({
        next: (consulta) => {
          this.consulta.set(consulta);
          if (iguales(this.formulario(), datos)) {
            escribirBorrador(this.consultaId(), null);
          }
          this.guardando.set(false);
          this.estadoGuardado.set('Cambios guardados');
          suscriptor.next(true);
          suscriptor.complete();
        },
        error: (respuesta: unknown) => {
          this.guardando.set(false);
          const error = leerErrorApi(respuesta);
          if (error.codigo === 'SIN_CONEXION') {
            this.estadoGuardado.set('');
            this.borrador.set(
              leerBorrador(this.consultaId()) ?? { datos, hora: new Date().toISOString() },
            );
          } else if (error.codigo === 'REGISTRO_CERRADO') {
            this.irAlRegistroCerrado();
          } else {
            this.error.set(error.mensaje);
          }
          suscriptor.next(false);
          suscriptor.complete();
        },
      });
    });
  }

  private perderConexion(): void {
    clearTimeout(this.temporizador);
    const borrador = { datos: this.formulario(), hora: new Date().toISOString() };
    escribirBorrador(this.consultaId(), borrador);
    this.borrador.set(borrador);
    this.estadoGuardado.set('');
  }

  private irAlRegistroCerrado(): void {
    this.router.navigate(['/personal/consultas', this.consultaId(), 'registro'], {
      queryParams: { aviso: 'cerrado' },
      replaceUrl: true,
    });
  }
}
