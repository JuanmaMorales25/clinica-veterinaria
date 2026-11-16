import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  startWith,
  switchMap,
} from 'rxjs';

import { environment } from '../../../../environments/environment';
import { leerErrorApi } from '../../../core/api/error-api';
import { escucharTeclaDemo } from '../../../core/demo/demo.service';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { AtencionService } from '../atencion.service';
import { ResumenMascota } from '../modelos';

/** M2.1 Buscar paciente (panel del personal). */
@Component({
  selector: 'cv-buscar-paciente',
  imports: [FormsModule, RouterLink, Encabezado, EstadoEtiqueta],
  template: `
    <cv-encabezado titulo="Panel del personal" rutaAtras="/" />
    <main class="contenido">
      <h2 class="titulo-pagina">Buscar paciente</h2>
      <div class="campo">
        <label for="busqueda"
          >Nombre, documento del propietario, teléfono o número de historia</label
        >
        <input
          id="busqueda"
          class="entrada entrada--destacada"
          type="search"
          autocomplete="off"
          [ngModel]="texto()"
          (ngModelChange)="buscar($event)"
        />
      </div>

      @if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      } @else {
        <p class="texto-suave" aria-live="polite">
          {{ resultados().length }} {{ resultados().length === 1 ? 'resultado' : 'resultados' }}
        </p>
      }

      @for (mascota of resultados(); track mascota.id; let primero = $first) {
        <article class="resultado">
          @if (mascota.fotografia) {
            <img class="resultado__foto" [src]="mascota.fotografia" alt="" />
          } @else {
            <div class="resultado__foto resultado__foto--vacia" aria-hidden="true"></div>
          }
          <div class="resultado__datos">
            <h3 class="resultado__nombre">{{ mascota.nombre }}</h3>
            <p class="texto-suave">
              {{ mascota.especie }}{{ mascota.edad ? ' · ' + mascota.edad : '' }} ·
              {{ mascota.numero_historia }}
            </p>
            <p class="resultado__propietario">
              Propietario(a): {{ mascota.propietario_nombre }} · {{ mascota.propietario_telefono }}
            </p>
          </div>
          <div class="resultado__estados">
            @for (alergia of mascota.alergias; track alergia.descripcion) {
              <cv-estado-etiqueta tipo="alerta" tamano="pequeno">
                ALERGIA: {{ alergia.descripcion }}
              </cv-estado-etiqueta>
            } @empty {
              <cv-estado-etiqueta tipo="exito" tamano="pequeno">Sin alergias</cv-estado-etiqueta>
            }
          </div>
          <a
            class="boton"
            [class.boton--primario]="primero"
            [class.boton--secundario]="!primero"
            [routerLink]="['/personal/pacientes', mascota.id]"
          >
            Abrir ficha
            <span class="solo-lectores">de {{ mascota.nombre }}</span>
          </a>
        </article>
      }
    </main>
  `,
  styles: `
    .resultado {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: var(--color-superficie);
      border: 1.5px solid var(--color-borde);
      border-radius: 14px;
    }
    .resultado__foto {
      flex-shrink: 0;
      width: 60px;
      height: 60px;
      border-radius: 11px;
      object-fit: cover;
    }
    .resultado__foto--vacia {
      background: var(--color-primario-suave);
    }
    .resultado__datos {
      display: flex;
      flex: 1 1 220px;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .resultado__nombre {
      color: var(--color-marino);
      font-size: 23px;
      font-weight: 700;
    }
    .resultado__propietario {
      color: var(--color-texto-suave);
      font-size: var(--texto-meta);
    }
    .resultado__estados {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export default class BuscarPaciente {
  private readonly atencion = inject(AtencionService);
  private readonly http = inject(HttpClient);
  private readonly busquedas = new Subject<string>();

  protected readonly texto = signal('');
  protected readonly resultados = signal<ResumenMascota[]>([]);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.busquedas
      .pipe(
        startWith(''),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((texto) =>
          this.atencion.buscarPacientes(texto).pipe(
            catchError((error: unknown) => {
              this.error.set(leerErrorApi(error).mensaje);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultados) => {
        this.error.set(null);
        this.resultados.set(resultados);
      });

    // Tecla 2: la API responde SESION_EXPIRADA y el interceptor lleva a la pantalla A4.
    escucharTeclaDemo('2', () =>
      this.http
        .post(`${environment.apiUrl}/demo/sesion-expirada`, {})
        .subscribe({ error: () => {} }),
    );
  }

  protected buscar(texto: string): void {
    this.texto.set(texto);
    this.busquedas.next(texto.trim());
  }
}
