import { Component, computed, input } from '@angular/core';

import { ICONOS_ESTADO, TipoEstado } from '../estado-etiqueta/estado-etiqueta';

/** Recuadro de aviso de los flujos alternos (por ejemplo, D2 Existencia insuficiente). */
@Component({
  selector: 'cv-aviso',
  template: `
    <div [class]="'aviso aviso--' + tipo()" [attr.role]="tipo() === 'exito' ? 'status' : 'alert'">
      <img [src]="iconoFinal()" alt="" width="33" height="33" />
      <div class="aviso__texto">
        <p class="aviso__titulo">{{ titulo() }}</p>
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .aviso {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 19px;
      border: 2px solid;
      border-radius: var(--radio-entrada);
      img {
        flex-shrink: 0;
      }
    }
    .aviso__texto {
      display: flex;
      flex-direction: column;
      gap: 5px;
      color: var(--color-texto);
      font-size: var(--texto-etiqueta);
    }
    .aviso__titulo {
      font-size: var(--texto-destacado);
      font-weight: 700;
    }
    .aviso--exito {
      background: var(--color-exito-fondo);
      border-color: var(--color-exito);
      .aviso__titulo {
        color: var(--color-exito);
      }
    }
    .aviso--alerta {
      background: var(--color-alerta-fondo);
      border-color: var(--color-alerta);
      .aviso__titulo {
        color: var(--color-alerta);
      }
    }
    .aviso--advertencia {
      background: var(--color-advertencia-fondo);
      border-color: var(--color-advertencia);
      .aviso__titulo {
        color: var(--color-advertencia);
      }
    }
    .aviso--primario {
      background: var(--color-primario-suave);
      border-color: var(--color-primario);
      .aviso__titulo {
        color: var(--color-marino);
      }
    }
    .aviso--info {
      background: var(--color-info-fondo);
      border-color: var(--color-info);
      .aviso__titulo {
        color: var(--color-info);
      }
    }
    .aviso--neutro {
      background: var(--color-neutro-fondo);
      border-color: var(--color-texto-suave);
      .aviso__titulo {
        color: var(--color-texto-suave);
      }
    }
  `,
})
export class Aviso {
  readonly tipo = input.required<TipoEstado>();
  readonly titulo = input.required<string>();
  readonly icono = input<string | null>(null);
  protected readonly iconoFinal = computed(() => this.icono() ?? ICONOS_ESTADO[this.tipo()]);
}
