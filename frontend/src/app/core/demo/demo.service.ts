import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Teclas 1 a 5 de la guía del Figma para provocar los flujos alternos que no ocurren solos.
 * Solo funcionan cuando la API corre con MODO_DEMO=true.
 */
@Injectable({ providedIn: 'root' })
export class DemoService {
  private readonly http = inject(HttpClient);
  readonly activo = signal(false);

  constructor() {
    this.http.get<{ modo_demo?: boolean }>(`${environment.apiUrl}/salud`).subscribe({
      next: (respuesta) => this.activo.set(respuesta.modo_demo === true),
      error: () => this.activo.set(false),
    });
  }
}

/**
 * Registra la tecla de demostración mientras viva el componente. Se llama en el constructor.
 * Se ignora si el foco está en un campo, para no interferir con lo que se escribe.
 */
export function escucharTeclaDemo(tecla: string, accion: () => void): void {
  const demo = inject(DemoService);
  const documento = inject(DOCUMENT);
  const alPresionar = (evento: KeyboardEvent) => {
    const objetivo = evento.target as HTMLElement | null;
    const escribiendo = objetivo?.closest('input, textarea, select, [contenteditable]');
    if (evento.key === tecla && demo.activo() && !escribiendo && !evento.repeat) {
      accion();
    }
  };
  documento.addEventListener('keydown', alPresionar);
  inject(DestroyRef).onDestroy(() => documento.removeEventListener('keydown', alPresionar));
}
