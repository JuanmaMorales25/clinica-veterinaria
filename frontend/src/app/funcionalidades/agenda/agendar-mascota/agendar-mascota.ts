import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { AgendaService } from '../agenda.service';
import { MascotaAgendada } from '../agenda.modelos';

@Component({
  selector: 'cv-agendar-mascota',
  imports: [FormsModule, RouterLink, Encabezado],
  template: `
    <cv-encabezado titulo="Agenda tu cita" rutaAtras="/propietario" />
    <main class="contenido">
      <p class="paso">PASO 1 DE 3</p>
      <h2 class="titulo-pagina">¿Para cuál mascota?</h2>
      <p class="texto-suave">Elige una mascota para continuar con la solicitud.</p>
      @if (error()) { <p class="ayuda-error" role="alert">{{ error() }}</p> }
      <div class="lista">
        @for (mascota of mascotas(); track mascota.id) {
          <button class="mascota tarjeta" type="button" (click)="elegir(mascota)">
            <span class="mascota__icono" aria-hidden="true">🐾</span>
            <span class="mascota__datos">
              <strong>{{ mascota.nombre }}</strong>
              <span>{{ mascota.especie }} · {{ mascota.numero_historia }}</span>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        } @empty {
          <p class="texto-suave">No hay mascotas vinculadas a tu cuenta.</p>
        }
      </div>
      <form class="tarjeta vincular" (ngSubmit)="vincular()">
        <h3 class="tarjeta__titulo">Vincular otra mascota</h3>
        <label class="campo">
          <span>Número de historia</span>
          <input class="entrada" name="historia" required [(ngModel)]="historia" placeholder="HC-00481" />
        </label>
        <button class="boton boton--secundario" type="submit" [disabled]="guardando()">
          {{ guardando() ? 'Buscando…' : 'Buscar por historia' }}
        </button>
      </form>
      <a class="volver" routerLink="/propietario">Volver a mis mascotas</a>
    </main>
  `,
  styles: `
    .paso { color: var(--color-primario); font-size: var(--texto-meta); font-weight: 700; }
    .lista { display: grid; gap: 12px; }
    .mascota { width: 100%; flex-direction: row; align-items: center; text-align: left; cursor: pointer; }
    .mascota__icono { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 50%; background: var(--color-primario-suave); }
    .mascota__datos { display: grid; flex: 1; gap: 4px; }
    .mascota__datos span { color: var(--color-texto-suave); font-size: var(--texto-meta); }
    .vincular { margin-top: 10px; }
    .volver { align-self: flex-start; }
  `,
})
export default class AgendarMascota {
  private readonly agenda = inject(AgendaService);
  private readonly router = inject(Router);
  protected readonly mascotas = signal<MascotaAgendada[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected historia = '';

  constructor() {
    this.cargarMascotas();
  }

  protected elegir(mascota: MascotaAgendada): void {
    this.router.navigate(['/propietario/agendar/servicio', mascota.id]);
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
        this.error.set(leerErrorApi(error).mensaje);
        this.guardando.set(false);
      },
    });
  }

  private cargarMascotas(): void {
    this.agenda.mascotas().subscribe({
      next: (mascotas) => this.mascotas.set(mascotas),
      error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
    });
  }
}
