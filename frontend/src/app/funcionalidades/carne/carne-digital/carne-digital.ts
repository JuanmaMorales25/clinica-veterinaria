import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as QRCode from 'qrcode';

import { environment } from '../../../../environments/environment';
import { leerErrorApi } from '../../../core/api/error-api';
import { escucharTeclaDemo } from '../../../core/demo/demo.service';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import {
  DatosTarjetaPaciente,
  TarjetaPaciente,
} from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { CarneService } from '../carne.service';
import { CarnetMascota, VacunaCarnet } from '../carne.modelos';

/** M4.1 Carné digital (solo lectura) y E1 cuando el enlace del código QR venció o no es válido. */
@Component({
  selector: 'cv-carne-digital',
  imports: [RouterLink, DatePipe, Encabezado, EstadoEtiqueta, TarjetaPaciente],
  template: `
    <cv-encabezado titulo="Carné digital" [rutaAtras]="rutaAtras" />
    <main class="contenido">
      @if (cargando()) {
        <p class="texto-suave" aria-live="polite">Cargando carné…</p>
      } @else if (error()) {
        <section class="tarjeta tarjeta-centrada tarjeta-estado" aria-labelledby="titulo-e1">
          <img class="tarjeta-estado__icono" src="iconos/reloj.svg" alt="" />
          <cv-estado-etiqueta tipo="neutro" tamano="pequeno">
            {{ codigoError() === 'ENLACE_VENCIDO' ? 'Enlace vencido' : 'Enlace no válido' }}
          </cv-estado-etiqueta>
          <h2 id="titulo-e1" class="tarjeta-estado__titulo">
            {{
              codigoError() === 'ENLACE_VENCIDO'
                ? 'Este enlace ya no está disponible'
                : 'Este enlace no es válido'
            }}
          </h2>
          <p>
            Por seguridad, el acceso al carné mediante código QR tiene vigencia limitada. Por eso no
            mostramos datos de la mascota ni de su propietario.
          </p>
          <p class="texto-suave">
            Pídele al propietario que genere un código QR nuevo desde su cuenta, o consulta
            directamente en la clínica.
          </p>
          <a class="boton boton--primario" routerLink="/acceso/iniciar-sesion">
            Iniciar sesión (propietarios)
          </a>
          <a class="boton boton--secundario" routerLink="/">Ver ubicación y horarios</a>
        </section>
      } @else if (carne(); as carne) {
        <div class="titulo-carne">
          <h2 class="titulo-pagina">Carné digital</h2>
          <cv-estado-etiqueta tipo="neutro" icono="iconos/candado.svg" tamano="pequeno">
            Solo lectura
          </cv-estado-etiqueta>
        </div>
        <cv-tarjeta-paciente [paciente]="paciente()!" variante="completa" />

        <section class="tarjeta" aria-labelledby="titulo-esquema">
          <h3 id="titulo-esquema" class="tarjeta__titulo">Esquema de vacunación</h3>
          @if (esquema().length) {
            <div class="tabla-contenedor">
              <table class="tabla">
                <thead>
                  <tr>
                    <th scope="col">Biológico</th>
                    <th scope="col">Aplicada</th>
                    <th scope="col">Próxima dosis</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (vacuna of esquema(); track vacuna.biologico) {
                    <tr>
                      <td>{{ vacuna.biologico }}</td>
                      <td>{{ vacuna.fecha_aplicacion | date: 'dd/MM/yyyy' }}</td>
                      <td>
                        {{
                          vacuna.fecha_proxima_dosis
                            ? (vacuna.fecha_proxima_dosis | date: 'dd/MM/yyyy')
                            : '—'
                        }}
                      </td>
                      <td>
                        @if (!vacuna.fecha_proxima_dosis) {
                          <cv-estado-etiqueta tipo="exito" tamano="pequeno"
                            >Completa</cv-estado-etiqueta
                          >
                        } @else if (vacuna.fecha_proxima_dosis >= hoy) {
                          <cv-estado-etiqueta
                            tipo="info"
                            icono="iconos/reloj-arena.svg"
                            tamano="pequeno"
                          >
                            Programada
                          </cv-estado-etiqueta>
                        } @else {
                          <cv-estado-etiqueta tipo="advertencia" tamano="pequeno">
                            Vencida
                          </cv-estado-etiqueta>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="texto-suave">Aún no hay vacunas registradas.</p>
          }
        </section>

        @if (!publico()) {
          <section class="tarjeta" aria-labelledby="titulo-compartir">
            <h3 id="titulo-compartir" class="tarjeta__titulo">Compartir carné</h3>
            <p class="texto-suave">
              El enlace firmado vence en 24 horas y permite consultar esta ficha en modo de solo
              lectura.
            </p>
            @if (codigoQr(); as codigoQr) {
              <img class="qr" [src]="codigoQr" alt="Código QR del carné" width="220" height="220" />
              <a class="boton boton--secundario" [href]="codigoQr" download="carne-digital-qr.png">
                Descargar código QR
              </a>
            }
            @if (errorCodigoQr()) {
              <p class="ayuda-error">{{ errorCodigoQr() }}</p>
            }
            @if (enlace(); as enlace) {
              <a class="enlace" [href]="enlace" target="_blank" rel="noopener">{{ enlace }}</a>
              <button class="boton boton--secundario" type="button" (click)="copiarEnlace()">
                {{ copiado() ? 'Enlace copiado' : 'Copiar enlace' }}
              </button>
            } @else {
              <button
                class="boton boton--secundario"
                type="button"
                [disabled]="generando()"
                (click)="generarEnlace()"
              >
                {{ generando() ? 'Generando…' : 'Generar enlace seguro' }}
              </button>
            }
          </section>
          <div class="acciones">
            <a class="boton boton--primario" routerLink="/propietario/preferencias">
              Preferencias de notificación
            </a>
            <a class="boton boton--secundario" routerLink="/propietario">Volver al inicio</a>
          </div>
        }
      }
    </main>
  `,
  styles: `
    .titulo-carne {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
    }
    .tabla-contenedor {
      overflow-x: auto;
    }
    .tabla {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: var(--texto-cuerpo);
      border: 1.5px solid var(--color-borde);
      border-radius: var(--radio-entrada);
      th {
        padding: 12px 14px;
        color: var(--color-marino);
        font-size: var(--texto-meta);
        font-weight: 600;
        text-align: left;
        background: var(--color-primario-suave);
      }
      td {
        padding: 14px;
        white-space: nowrap;
        border-top: 1px solid var(--color-borde);
      }
    }
    .qr {
      align-self: flex-start;
      padding: 8px;
      background: #fff;
      border: 1.5px solid var(--color-borde);
      border-radius: var(--radio-entrada);
    }
    .enlace {
      font-size: var(--texto-meta);
      word-break: break-all;
    }
    .tarjeta .boton {
      align-self: flex-start;
    }
  `,
})
export default class CarneDigital {
  private readonly carneService = inject(CarneService);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private mascotaId: string | null = null;

  protected readonly carne = signal<CarnetMascota | null>(null);
  protected readonly cargando = signal(true);
  protected readonly generando = signal(false);
  protected readonly enlace = signal<string | null>(null);
  protected readonly codigoQr = signal<string | null>(null);
  protected readonly errorCodigoQr = signal<string | null>(null);
  protected readonly copiado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly codigoError = signal<string | null>(null);
  protected readonly publico = signal(false);
  protected rutaAtras = '/propietario';
  protected readonly hoy = new Date().toISOString().slice(0, 10);
  protected readonly paciente = computed<DatosTarjetaPaciente | null>(() => {
    const carne = this.carne();
    return carne
      ? {
          nombre: carne.nombre,
          especie: carne.especie,
          edad: carne.edad,
          numero_historia: carne.numero_historia,
          fotografia: carne.fotografia,
          alergias: carne.alergias,
          esquema_al_dia: carne.esquema_al_dia,
          ultima_atencion: carne.ultima_atencion,
        }
      : null;
  });
  /** Última dosis de cada biológico, como en el esquema del Figma. */
  protected readonly esquema = computed<VacunaCarnet[]>(() => {
    const ultimas = new Map<string, VacunaCarnet>();
    for (const vacuna of this.carne()?.vacunas ?? []) {
      if (!ultimas.has(vacuna.biologico)) ultimas.set(vacuna.biologico, vacuna);
    }
    return [...ultimas.values()];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const token = parametros.get('token');
      this.mascotaId = parametros.get('mascotaId');
      this.rutaAtras = token ? '/' : '/propietario';
      if (token) this.cargarPublico(token);
      else if (this.mascotaId) {
        this.publico.set(false);
        this.cargarPrivado(this.mascotaId);
      } else this.mostrarError('CARNET_NO_ENCONTRADO', 'No encontramos ese carné.');
    });

    escucharTeclaDemo('5', () => {
      this.http.get<{ token: string }>(`${environment.apiUrl}/demo/carne-vencido`).subscribe({
        next: ({ token }) => this.cargarPublico(token),
        error: (error: unknown) => this.manejarError(error),
      });
    });
  }

  protected generarEnlace(): void {
    if (!this.mascotaId || this.generando()) return;
    this.generando.set(true);
    this.codigoQr.set(null);
    this.errorCodigoQr.set(null);
    this.copiado.set(false);
    this.carneService.crearEnlace(this.mascotaId).subscribe({
      next: (respuesta) => {
        this.enlace.set(respuesta.enlace);
        void QRCode.toDataURL(respuesta.enlace, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 220,
          color: { dark: '#123a4d', light: '#ffffff' },
        })
          .then((imagen) => this.codigoQr.set(imagen))
          .catch(() =>
            this.errorCodigoQr.set(
              'No pudimos crear el código QR. Puedes copiar y compartir el enlace.',
            ),
          );
        this.generando.set(false);
      },
      error: (error: unknown) => {
        this.manejarError(error);
        this.generando.set(false);
      },
    });
  }

  protected copiarEnlace(): void {
    const enlace = this.enlace();
    if (!enlace || !navigator.clipboard) return;
    navigator.clipboard.writeText(enlace).then(() => this.copiado.set(true));
  }

  private cargarPrivado(id: string): void {
    this.carneService.privado(id).subscribe({
      next: (ficha) => {
        this.carne.set(ficha);
        this.cargando.set(false);
      },
      error: (error: unknown) => this.manejarError(error),
    });
  }

  private cargarPublico(token: string): void {
    this.publico.set(true);
    this.cargando.set(true);
    this.error.set(null);
    this.carneService.publico(token).subscribe({
      next: (ficha) => {
        this.carne.set(ficha);
        this.cargando.set(false);
      },
      error: (error: unknown) => this.manejarError(error),
    });
  }

  private manejarError(error: unknown): void {
    const respuesta = leerErrorApi(error);
    this.mostrarError(respuesta.codigo, respuesta.mensaje);
  }

  private mostrarError(codigo: string, mensaje: string): void {
    this.codigoError.set(codigo);
    this.error.set(mensaje);
    this.cargando.set(false);
  }
}
