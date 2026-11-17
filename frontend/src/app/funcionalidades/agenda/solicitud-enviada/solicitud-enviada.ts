import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';

/** M1.3 Solicitud enviada: la cita queda pendiente hasta que el personal la confirme. */
@Component({
  selector: 'cv-solicitud-enviada',
  imports: [DatePipe, RouterLink, Encabezado, EstadoEtiqueta],
  template: `
    <cv-encabezado titulo="Agendar cita" [conAtras]="false" />
    <main class="contenido">
      <section class="tarjeta tarjeta-centrada tarjeta-estado" aria-labelledby="titulo-enviada">
        <img class="tarjeta-estado__icono" src="iconos/check.svg" alt="" />
        <cv-estado-etiqueta tipo="info" icono="iconos/reloj-arena.svg" tamano="pequeno">
          Pendiente de confirmar
        </cv-estado-etiqueta>
        <h2 id="titulo-enviada" class="tarjeta-estado__titulo">Solicitud enviada</h2>
        <p>
          Recibimos tu solicitud. La clínica la confirmará y te avisaremos por el canal que tengas
          configurado.
        </p>
        <dl class="resumen">
          <div>
            <dt>Mascota:</dt>
            <dd>{{ mascota }}{{ especie ? ' · ' + especie : '' }}</dd>
          </div>
          <div>
            <dt>Servicio:</dt>
            <dd>{{ servicio }}</dd>
          </div>
          @if (fecha) {
            <div>
              <dt>Fecha y hora:</dt>
              <dd>{{ fecha | date: 'EEEE dd/MM/yyyy · HH:mm' }}</dd>
            </div>
          }
        </dl>
        @if (mascotaId) {
          <a class="boton boton--primario" [routerLink]="['/propietario/carne', mascotaId]">
            Ver carné digital
          </a>
        }
        <a class="boton boton--secundario" routerLink="/propietario">Volver al inicio</a>
      </section>
    </main>
  `,
  styles: `
    .resumen {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      margin: 0;
      padding: 14px 16px;
      text-align: left;
      background: var(--color-primario-suave);
      border: 1.5px solid var(--color-primario);
      border-radius: var(--radio-entrada);
      div {
        display: flex;
        gap: 6px;
      }
      dd {
        margin: 0;
      }
    }
  `,
})
export default class SolicitudEnviada {
  private readonly route = inject(ActivatedRoute);
  private readonly params = this.route.snapshot.queryParamMap;
  protected readonly mascotaId = this.params.get('mascotaId');
  protected readonly mascota = this.params.get('mascota') ?? 'tu mascota';
  protected readonly especie = this.params.get('especie') ?? '';
  protected readonly servicio = this.params.get('servicio') ?? '';
  protected readonly fecha = this.params.get('fecha');
}
