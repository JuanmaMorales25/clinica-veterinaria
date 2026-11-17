import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Encabezado } from '../../../compartido/encabezado/encabezado';

@Component({
  selector: 'cv-solicitud-enviada',
  imports: [RouterLink, Encabezado, DatePipe],
  template: `
    <cv-encabezado titulo="Solicitud enviada" rutaAtras="/propietario" />
    <main class="contenido">
      <section class="tarjeta confirmacion">
        <div class="sello" aria-hidden="true">✓</div>
        <h2 class="titulo-pagina">¡Recibimos tu solicitud!</h2>
        <p>
          La cita para <strong>{{ mascota }}</strong> está pendiente. Te avisaremos cuando el personal
          confirme el horario.
        </p>
        @if (fecha) { <p class="texto-suave">{{ fecha | date:'EEEE d MMMM, h:mm a' }}</p> }
        @if (servicio) { <p class="texto-suave">Servicio: {{ servicio }}</p> }
        <a class="boton boton--primario" routerLink="/propietario">Volver a mis mascotas</a>
      </section>
    </main>
  `,
  styles: `
    .confirmacion { align-items: center; text-align: center; padding: 36px; }
    .sello { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 50%; background: var(--color-exito-fondo); color: var(--color-exito); font-size: 32px; font-weight: 700; }
  `,
})
export default class SolicitudEnviada {
  private readonly route = inject(ActivatedRoute);
  protected readonly mascota = this.route.snapshot.queryParamMap.get('mascota') ?? 'tu mascota';
  protected readonly servicio = this.route.snapshot.queryParamMap.get('servicio') ?? '';
  protected readonly fecha = this.route.snapshot.queryParamMap.get('fecha');
}
