import { Component, computed, input } from '@angular/core';

export type TipoEstado = 'exito' | 'alerta' | 'advertencia' | 'info' | 'neutro';

export const ICONOS_ESTADO: Record<TipoEstado, string> = {
  exito: 'iconos/check.svg',
  alerta: 'iconos/advertencia.svg',
  advertencia: 'iconos/abajo.svg',
  info: 'iconos/reloj-arena.svg',
  neutro: 'iconos/candado.svg',
};

/** Píldora de estado: color + icono + etiqueta, como pide la guía de color del Figma. */
@Component({
  selector: 'cv-estado-etiqueta',
  template: `
    <span [class]="'estado estado--' + tipo() + ' estado--' + tamano()">
      <img [src]="iconoFinal()" alt="" />
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
      img {
        width: 20px;
        height: 20px;
      }
    }
    .estado--pequeno {
      padding: 5px 11px;
      font-size: 15px;
      img {
        width: 18px;
        height: 18px;
      }
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
    .estado--info {
      background: var(--color-info-fondo);
      border-color: var(--color-info);
      color: var(--color-info);
    }
    .estado--neutro {
      background: var(--color-neutro-fondo);
      border-color: var(--color-texto-suave);
      color: var(--color-texto-suave);
    }
  `,
})
export class EstadoEtiqueta {
  readonly tipo = input.required<TipoEstado>();
  readonly tamano = input<'normal' | 'pequeno'>('normal');
  /** Reemplaza el icono por defecto del tipo (por ejemplo, el reloj del borrador). */
  readonly icono = input<string | null>(null);
  protected readonly iconoFinal = computed(() => this.icono() ?? ICONOS_ESTADO[this.tipo()]);
}
