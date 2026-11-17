import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { AgendaService } from '../agenda.service';
import { MascotaAgendada } from '../agenda.modelos';

/** Agenda tu cita: elegir la mascota. "+ Agregar Mascota" abre la vinculación por historia (B2). */
@Component({
  selector: 'cv-agendar-mascota',
  imports: [FormsModule, Aviso, Encabezado],
  template: `
    @if (vinculando()) {
      <cv-encabezado titulo="Agregar mascota" [conAtras]="false" />
      <main class="contenido">
        <form class="tarjeta tarjeta-centrada" (ngSubmit)="vincular()">
          <h2 class="tarjeta__titulo">Vincula tu mascota</h2>
          <p class="texto-suave">
            Escribe el número de historia que te entregó la clínica durante la primera atención de
            tu mascota.
          </p>
          <div class="campo">
            <label for="historia">Número de historia</label>
            <input
              id="historia"
              class="entrada"
              [class.entrada--advertencia]="error()"
              name="historia"
              required
              placeholder="HC-00481"
              [(ngModel)]="historia"
            />
            @if (error()) {
              <p class="ayuda-advertencia" role="alert">
                <img src="iconos/advertencia-ambar.svg" alt="" width="16" height="16" />
                {{ error() }} Revisa que coincida con el que te entregó la clínica.
              </p>
            }
          </div>
          <cv-aviso tipo="primario" titulo="¿No tienes el número?" icono="iconos/info.svg">
            <p>
              El número de historia se entrega de forma presencial en la clínica. Pídelo en tu
              próxima visita o llámanos al 604 495 39 04.
            </p>
          </cv-aviso>
          <button class="boton boton--primario" type="submit" [disabled]="guardando()">
            {{ guardando() ? 'Buscando…' : 'Vincular mascota' }}
          </button>
          <button class="boton boton--secundario" type="button" (click)="cancelarVinculo()">
            Cancelar
          </button>
        </form>
      </main>
    } @else {
      <cv-encabezado titulo="Agendar cita" rutaAtras="/propietario" />
      <main class="contenido contenido--ancho">
        <h2 class="titulo-pagina">Solicita cita para una mascota</h2>
        <section class="eleccion" aria-labelledby="titulo-eleccion">
          <h3 id="titulo-eleccion" class="eleccion__titulo">Elige tu mascota</h3>
          @if (errorCarga()) {
            <p class="ayuda-error" role="alert">{{ errorCarga() }}</p>
          }
          <div class="mascotas">
            @for (mascota of mascotas(); track mascota.id) {
              <article class="mascota">
                @if (mascota.fotografia) {
                  <img [src]="mascota.fotografia" [alt]="'Foto de ' + mascota.nombre" />
                } @else {
                  <span class="mascota__sin-foto" aria-hidden="true">🐾</span>
                }
                <p class="mascota__datos">
                  <span>{{ mascota.nombre }}</span>
                  <span>{{ mascota.especie }} - {{ mascota.edad }}</span>
                </p>
                <button type="button" class="mascota__elegir" (click)="elegir(mascota)">
                  Seleccionar
                </button>
              </article>
            } @empty {
              <p class="texto-suave">No hay mascotas vinculadas a tu cuenta.</p>
            }
          </div>
        </section>
        <button type="button" class="boton boton--primario agregar" (click)="vinculando.set(true)">
          + Agregar Mascota
        </button>
      </main>
    }
  `,
  styles: `
    .contenido--ancho {
      max-width: 1100px;
    }
    .eleccion {
      display: flex;
      flex-direction: column;
      gap: 24px;
      margin: 0 -16px;
      padding: 22px clamp(16px, 4vw, 48px) 28px;
      background: var(--color-primario-suave);
      border-top: 1.5px solid var(--color-borde);
    }
    .eleccion__titulo {
      color: var(--color-primario);
      font-size: var(--texto-seccion);
      font-weight: 600;
    }
    .mascotas {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 32px 48px;
    }
    .mascota {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      img,
      .mascota__sin-foto {
        width: 100%;
        max-width: 420px;
        aspect-ratio: 420 / 380;
        border-radius: 12px;
        object-fit: cover;
      }
      .mascota__sin-foto {
        display: grid;
        place-items: center;
        font-size: 64px;
        background: var(--color-superficie);
      }
    }
    .mascota__datos {
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: var(--texto-cuerpo);
    }
    .mascota__elegir {
      min-width: 190px;
      padding: 12px 24px;
      color: var(--color-texto);
      font: inherit;
      font-size: var(--texto-cuerpo);
      background: var(--color-superficie);
      border: 0;
      border-radius: var(--radio-boton);
      cursor: pointer;
      &:hover {
        background: var(--color-encabezado);
      }
    }
    .agregar {
      align-self: center;
    }
    .entrada--advertencia {
      border: 2px solid var(--color-advertencia);
    }
    .ayuda-advertencia {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      color: var(--color-advertencia);
      font-size: var(--texto-meta);
      img {
        margin-top: 3px;
      }
    }
  `,
})
export default class AgendarMascota {
  private readonly agenda = inject(AgendaService);
  private readonly router = inject(Router);
  protected readonly mascotas = signal<MascotaAgendada[]>([]);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly vinculando = signal(false);
  protected historia = '';

  constructor() {
    this.agenda.mascotas().subscribe({
      next: (mascotas) => this.mascotas.set(mascotas),
      error: (error: unknown) => this.errorCarga.set(leerErrorApi(error).mensaje),
    });
  }

  protected elegir(mascota: MascotaAgendada): void {
    this.router.navigate(['/propietario/agendar/servicio', mascota.id]);
  }

  protected cancelarVinculo(): void {
    this.vinculando.set(false);
    this.error.set(null);
    this.historia = '';
  }

  protected vincular(): void {
    if (this.guardando() || !this.historia.trim()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.agenda.vincularMascota(this.historia).subscribe({
      next: (mascota) => {
        this.guardando.set(false);
        this.router.navigate(['/propietario/agendar/servicio', mascota.id]);
      },
      error: (error: unknown) => {
        const respuesta = leerErrorApi(error);
        this.error.set(
          respuesta.codigo === 'HISTORIA_NO_ENCONTRADA'
            ? 'No encontramos ese número de historia.'
            : respuesta.mensaje,
        );
        this.guardando.set(false);
      },
    });
  }
}
