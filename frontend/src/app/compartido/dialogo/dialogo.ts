import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/**
 * Ventana modal sobre el fondo atenuado (C1, C2, D4). Usa <dialog> nativo: atrapa el foco y
 * se cierra con Escape, que equivale a la acción secundaria.
 */
@Component({
  selector: 'cv-dialogo',
  template: `
    <dialog
      #dialogo
      [class]="'dialogo dialogo--' + tono()"
      [attr.aria-labelledby]="idTitulo()"
      (cancel)="$event.preventDefault(); cerrar.emit()"
    >
      <ng-content />
    </dialog>
  `,
  styles: `
    .dialogo {
      width: min(598px, calc(100% - 32px));
      max-height: calc(100% - 32px);
      padding: 33px;
      background: var(--color-superficie);
      border: 3px solid var(--color-primario);
      border-radius: 16px;
      color: var(--color-texto);
    }
    .dialogo--alerta {
      border-color: var(--color-alerta);
    }
    .dialogo::backdrop {
      background: var(--color-velo);
    }
    :host ::ng-deep .dialogo > * + * {
      margin-top: 16px;
    }
    @media (max-width: 640px) {
      .dialogo {
        padding: 22px;
      }
    }
  `,
})
export class Dialogo {
  readonly abierto = input(false);
  readonly tono = input<'alerta' | 'primario'>('primario');
  readonly idTitulo = input<string | null>(null);
  readonly cerrar = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const elemento = this.dialogo().nativeElement;
      if (this.abierto() && !elemento.open) {
        elemento.showModal();
      } else if (!this.abierto() && elemento.open) {
        elemento.close();
      }
    });
  }
}
