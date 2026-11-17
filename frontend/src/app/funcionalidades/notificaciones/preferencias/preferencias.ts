import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { leerErrorApi } from '../../../core/api/error-api';
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

@Component({
  selector: 'cv-preferencias-notificacion',
  imports: [FormsModule, RouterLink, Encabezado],
  template: `
    <cv-encabezado titulo="Preferencias de notificación" rutaAtras="/propietario" />
    <main class="contenido">
      <h2 class="titulo-pagina">¿Cómo quieres recibir avisos?</h2>
      @if (error()) { <p class="ayuda-error" role="alert">{{ error() }}</p> }
      @if (guardado()) { <p class="guardado" role="status">Tus preferencias se guardaron.</p> }
      @if (cargando()) { <p class="texto-suave">Cargando preferencias…</p> } @else {
        <form class="tarjeta" (ngSubmit)="guardar()">
          <fieldset class="grupo">
            <legend>Canal preferido</legend>
            <label class="opcion">
              <input type="radio" name="canal" value="CORREO" [(ngModel)]="preferencias.canal" />
              <span>Correo electrónico</span>
            </label>
            <label class="opcion">
              <input type="radio" name="canal" value="MENSAJERIA" [(ngModel)]="preferencias.canal" />
              <span>Mensaje de texto <small>(simulado en el prototipo)</small></span>
            </label>
          </fieldset>
          <label class="opcion opcion--switch">
            <input type="checkbox" name="recibir" [(ngModel)]="preferencias.recibir_recordatorios" />
            <span><strong>Recordatorios de salud</strong><small>Próximas dosis y cuidados de tu mascota</small></span>
          </label>
          <label class="opcion opcion--switch">
            <input type="checkbox" name="citas" [(ngModel)]="preferencias.recordatorio_citas" [disabled]="!preferencias.recibir_recordatorios" />
            <span><strong>Recordatorios de citas</strong><small>Un aviso de tus próximas atenciones</small></span>
          </label>
          <label class="campo hora">
            <span>Hora preferida para recibir avisos</span>
            <input class="entrada" type="time" name="hora" [(ngModel)]="preferencias.hora_preferida" [disabled]="!preferencias.recibir_recordatorios" />
          </label>
          <div class="acciones">
            <button class="boton boton--primario" type="submit" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Guardar preferencias' }}
            </button>
            <a class="boton boton--secundario" routerLink="/propietario">Volver</a>
          </div>
        </form>
      }
    </main>
  `,
  styles: `
    .grupo { display: grid; gap: 14px; padding: 0; border: 0; }
    .grupo legend { margin-bottom: 12px; color: var(--color-marino); font-weight: 600; }
    .opcion { display: flex; align-items: center; gap: 12px; }
    .opcion input { width: 20px; height: 20px; accent-color: var(--color-primario); }
    .opcion--switch span { display: grid; gap: 3px; }
    .opcion small { color: var(--color-texto-suave); }
    .hora { max-width: 300px; }
    .guardado { color: var(--color-exito); }
  `,
})
export default class PreferenciasNotificacion {
  private readonly http = inject(HttpClient);
  protected preferencias = { ...PREDETERMINADAS };
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.http.get<Preferencias>(`${environment.apiUrl}/notificaciones/preferencias`).subscribe({
      next: (preferencias) => {
        this.preferencias = { ...preferencias, hora_preferida: preferencias.hora_preferida.slice(0, 5) };
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
    this.http.put<Preferencias>(`${environment.apiUrl}/notificaciones/preferencias`, this.preferencias).subscribe({
      next: (preferencias) => {
        this.preferencias = { ...preferencias, hora_preferida: preferencias.hora_preferida.slice(0, 5) };
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
