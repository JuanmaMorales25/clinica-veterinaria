import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as QRCode from 'qrcode';

import { environment } from '../../../../environments/environment';
import { leerErrorApi } from '../../../core/api/error-api';
import { escucharTeclaDemo } from '../../../core/demo/demo.service';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { CarneService } from '../carne.service';
import { CarnetMascota } from '../carne.modelos';

@Component({
  selector: 'cv-carne-digital',
  imports: [RouterLink, DatePipe, Aviso, Encabezado, EstadoEtiqueta],
  template: `
    <cv-encabezado titulo="Carné digital" [rutaAtras]="rutaAtras" />
    <main class="contenido">
      @if (error()) {
        <cv-aviso tipo="alerta" [titulo]="codigoError() === 'ENLACE_VENCIDO' ? 'Este enlace venció' : 'No se pudo abrir el carné'">
          <p>{{ error() }}</p>
        </cv-aviso>
        @if (codigoError() === 'ENLACE_VENCIDO') {
          <p class="texto-suave">Pídele al propietario que genere un enlace nuevo.</p>
        }
        <a class="boton boton--secundario" routerLink="/">Ir al inicio</a>
      } @else if (cargando()) {
        <p class="texto-suave" aria-live="polite">Cargando el carné…</p>
      } @else if (carne(); as ficha) {
        <section class="tarjeta identidad">
          <div class="identidad__icono" aria-hidden="true">🐾</div>
          <div class="identidad__datos">
            <p class="sobrelinea">{{ ficha.especie }}{{ ficha.raza ? ' · ' + ficha.raza : '' }}</p>
            <h2 class="titulo-pagina">{{ ficha.nombre }}</h2>
            <p class="texto-suave">Historia clínica {{ ficha.numero_historia }}{{ ficha.edad ? ' · ' + ficha.edad : '' }}</p>
          </div>
        </section>

        <section class="tarjeta">
          <div class="seccion__titulo">
            <h3 class="tarjeta__titulo">Alergias</h3>
            @if (ficha.alergias.length) {
              <cv-estado-etiqueta tipo="alerta">Revisar antes de atender</cv-estado-etiqueta>
            }
          </div>
          @for (alergia of ficha.alergias; track alergia.descripcion) {
            <div class="dato-alergia"><strong>{{ alergia.descripcion }}</strong><span>{{ alergia.severidad }}</span></div>
          } @empty {
            <p class="texto-suave">No hay alergias registradas.</p>
          }
        </section>

        <section class="tarjeta">
          <h3 class="tarjeta__titulo">Próximas dosis</h3>
          @for (vacuna of ficha.proximas_dosis; track vacuna.biologico + vacuna.fecha_proxima_dosis) {
            <div class="fila-dato">
              <strong>{{ vacuna.biologico }}</strong>
              <span>{{ vacuna.fecha_proxima_dosis | date:'d MMMM y' }}</span>
            </div>
          } @empty {
            <p class="texto-suave">No hay dosis próximas registradas.</p>
          }
        </section>

        <section class="tarjeta">
          <h3 class="tarjeta__titulo">Historial de vacunación</h3>
          @for (vacuna of ficha.vacunas; track vacuna.biologico + vacuna.fecha_aplicacion) {
            <div class="fila-dato">
              <strong>{{ vacuna.biologico }}</strong>
              <span>Aplicada {{ vacuna.fecha_aplicacion | date:'d MMMM y' }}</span>
            </div>
          } @empty {
            <p class="texto-suave">Aún no hay vacunas registradas.</p>
          }
        </section>

        @if (!publico()) {
          <section class="tarjeta compartir">
            <h3 class="tarjeta__titulo">Compartir carné</h3>
            <p class="texto-suave">El enlace firmado vence en 24 horas y permite consultar esta ficha.</p>
            <button class="boton boton--secundario" type="button" [disabled]="generando()" (click)="generarEnlace()">
              {{ generando() ? 'Generando…' : 'Generar enlace seguro' }}
            </button>
            @if (enlace()) {
              @if (codigoQr(); as imagenQr) {
                <figure class="codigo-qr">
                  <img
                    [src]="imagenQr"
                    [alt]="'Código QR para consultar el carné de ' + ficha.nombre"
                    width="220"
                    height="220"
                  />
                  <figcaption>Escanea el código para abrir el carné durante las próximas 24 horas.</figcaption>
                  <a class="boton boton--secundario" [href]="imagenQr" [download]="'carne-' + ficha.numero_historia + '.png'">
                    Descargar código QR
                  </a>
                </figure>
              }
              <a class="enlace-compartido" [href]="enlace()" target="_blank" rel="noopener">{{ enlace() }}</a>
              @if (errorCodigoQr()) { <p class="ayuda-error" role="alert">{{ errorCodigoQr() }}</p> }
              <button class="boton boton--primario" type="button" (click)="copiarEnlace()">Copiar enlace</button>
              @if (copiado()) { <p class="texto-suave" role="status">Enlace copiado.</p> }
            }
          </section>
        }
      }
    </main>
  `,
  styles: `
    .identidad { flex-direction: row; align-items: center; }
    .identidad__icono { display: grid; place-items: center; width: 76px; height: 76px; flex: 0 0 76px; border-radius: 18px; background: var(--color-primario-suave); font-size: 36px; }
    .identidad__datos { display: grid; gap: 5px; }
    .sobrelinea { color: var(--color-exito); font-size: var(--texto-meta); font-weight: 600; }
    .seccion__titulo { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .dato-alergia, .fila-dato { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid var(--color-borde); }
    .dato-alergia span { color: var(--color-alerta); }
    .fila-dato span { color: var(--color-texto-suave); }
    .compartir { align-items: flex-start; }
    .codigo-qr { display: grid; justify-items: start; gap: 10px; margin: 0; }
    .codigo-qr img { width: min(220px, 100%); height: auto; padding: 8px; border: 1px solid var(--color-borde); border-radius: 10px; background: white; }
    .codigo-qr figcaption { max-width: 34rem; color: var(--color-texto-suave); font-size: var(--texto-meta); }
    .enlace-compartido { overflow-wrap: anywhere; }
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
