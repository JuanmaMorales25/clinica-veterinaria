import { Component, computed, input } from '@angular/core';

export type TipoEstado = 'exito' | 'alerta' | 'advertencia';

const ICONOS: Record<TipoEstado, string> = {
  exito: 'iconos/check.svg',
  alerta: 'iconos/advertencia.svg',
  advertencia: 'iconos/abajo.svg',
};

/** Píldora de estado: color + icono + etiqueta, como pide la guía de color del Figma. */
@Component({
  selector: 'cv-estado-etiqueta',
  template: `
    <span [class]="'estado estado--' + tipo()">
      <img [src]="icono()" alt="" width="20" height="20" />
      <ng-content />
    </span>
  `,
  styles: `
    .estado {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 12px;
      border: 1.5px solid;
      border-radius: 999px;
      font-size: var(--texto-etiqueta);
      font-weight: 600;
      white-space: nowrap;
    }
    .estado--exito {
      background: var(--color-exito-fondo);
      border-color: var(--color-exito);
      color: var(--color-exito);
    }
    .estado--alerta {
      background: var(--color-alerta-fondo);
      border-color: var(--color-alerta);
      color: var(--color-alerta);
    }
    .estado--advertencia {
      background: var(--color-advertencia-fondo);
      border-color: var(--color-advertencia);
      color: var(--color-advertencia);
    }
  `,
})
export class EstadoEtiqueta {
  readonly tipo = input.required<TipoEstado>();
  protected readonly icono = computed(() => ICONOS[this.tipo()]);
}
