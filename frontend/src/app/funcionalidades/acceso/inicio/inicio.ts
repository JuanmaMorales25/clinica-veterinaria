import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ServicioPortada {
  titulo: string;
  texto: string;
  imagen: string;
}

interface PasoPortada {
  numero: string;
  titulo: string;
  texto: string;
  imagen: string;
}

const SERVICIOS: ServicioPortada[] = [
  {
    titulo: 'Consulta General',
    texto:
      'Evaluación del estado de salud de tu mascota para detectar posibles problemas y brindar la atención necesaria.',
    imagen: 'inicio/consulta.jpg',
  },
  {
    titulo: 'Vacunación',
    texto:
      'Aplicación y seguimiento de las vacunas necesarias para proteger a tu mascota y mantener su esquema de vacunación al día.',
    imagen: 'inicio/vacunacion.jpg',
  },
  {
    titulo: 'Desparasitación',
    texto:
      'Prevención y control de parásitos mediante un esquema adecuado para mantener a tu mascota saludable.',
    imagen: 'inicio/desparasitacion.jpg',
  },
  {
    titulo: 'Medicamentos e Insumos',
    texto:
      'Orientación y gestión de medicamentos e insumos indicados para el tratamiento y cuidado de la salud de tu mascota.',
    imagen: 'inicio/medicamentos.jpg',
  },
];

const PASOS: PasoPortada[] = [
  { numero: '01', titulo: 'Agendar', texto: 'Solicita tu cita', imagen: 'inicio/paso1.jpg' },
  {
    numero: '02',
    titulo: 'Atención',
    texto: 'Recibe la atención veterinaria',
    imagen: 'inicio/paso2.jpg',
  },
  {
    numero: '03',
    titulo: 'Seguimiento',
    texto: 'Consulta el historial de tu mascota',
    imagen: 'inicio/paso3.jpg',
  },
];

/** Página principal pública: presenta la clínica y lleva a agendar o iniciar sesión. */
@Component({
  selector: 'cv-inicio',
  imports: [RouterLink],
  template: `
    <header class="barra">
      <a class="barra__logo" href="#inicio" aria-label="Clínica Veterinaria, inicio">
        <img src="logo.png" alt="" width="82" height="82" />
      </a>
      <nav class="barra__menu" aria-label="Secciones">
        <a href="#inicio">Inicio</a>
        <a href="#servicios">Servicios</a>
        <a href="#nosotros">Nosotros</a>
      </nav>
      <div class="barra__acciones">
        <a class="boton boton--primario" routerLink="/propietario/agendar">Agendar Cita</a>
        <a class="boton boton--primario" routerLink="/acceso/iniciar-sesion">Iniciar Sesión</a>
      </div>
    </header>

    <main class="portada">
      <section id="inicio" class="bloque">
        <h1 class="portada__titulo">Clínica Veterinaria</h1>
        <p class="portada__lema">
          Porque su amor es incondicional, su cuidado es nuestra prioridad.
        </p>
        <img
          class="portada__foto"
          src="inicio/hero.jpg"
          alt="Un perro y un gato asomados sobre una mesa"
          width="1280"
          height="536"
        />
        <p class="portada__intro">
          Brindamos atención veterinaria y seguimiento integral para el bienestar de tu mascota,
          acompañándola en cada etapa de su vida.
        </p>
      </section>

      <section id="servicios" class="bloque" aria-labelledby="titulo-servicios">
        <h2 id="titulo-servicios" class="portada__seccion">Servicios</h2>
        <div class="servicios">
          @for (servicio of servicios; track servicio.titulo; let par = $odd) {
            <article class="servicio" [class.servicio--derecha]="par">
              <img [src]="servicio.imagen" alt="" width="330" height="303" />
              <div class="servicio__texto">
                <h3>{{ servicio.titulo }}</h3>
                <p>{{ servicio.texto }}</p>
              </div>
            </article>
          }
        </div>
      </section>

      <section id="nosotros" class="bloque" aria-labelledby="titulo-nosotros">
        <h2 id="titulo-nosotros" class="portada__seccion">Nosotros</h2>
        <div class="nosotros">
          <img src="logo.png" alt="" width="200" height="200" />
          <div>
            <h3>¿Quiénes somos?</h3>
            <p>Atención veterinaria centrada en el bienestar de tu mascota</p>
            <p>
              Somos una clínica veterinaria orientada a brindar una atención organizada y cercana,
              integrando la consulta, el seguimiento clínico, la vacunación, la desparasitación y el
              manejo de medicamentos e insumos.
            </p>
            <p>
              Nuestro objetivo es facilitar tanto la atención de las mascotas como la comunicación
              con sus propietarios, manteniendo su información organizada y disponible cuando sea
              necesaria.
            </p>
          </div>
        </div>
      </section>

      <section class="bloque" aria-labelledby="titulo-acompanamos">
        <h2 id="titulo-acompanamos" class="portada__seccion portada__seccion--centro">
          ¿Cómo te acompañamos?
        </h2>
        <div class="pasos">
          @for (paso of pasos; track paso.numero) {
            <div class="paso">
              <img [src]="paso.imagen" alt="" width="403" height="248" />
              <div class="paso__caja">
                <strong>{{ paso.numero }}</strong>
                <span>{{ paso.titulo }}</span>
                <span>{{ paso.texto }}</span>
              </div>
            </div>
          }
        </div>
        <div class="recordatorios">
          <img src="inicio/paso4.jpg" alt="" width="363" height="242" />
          <div class="paso__caja">
            <strong>04</strong>
            <span>Recordatorios Personalizados</span>
            <span>
              Activa opcionalmente recordatorios para tus próximas citas, vacunas y
              desparasitaciones. Puedes activar o desactivar esta función cuando quieras desde tu
              cuenta.
            </span>
          </div>
        </div>
      </section>

      <section class="bloque" aria-labelledby="titulo-lineas">
        <h2 id="titulo-lineas" class="lineas__titulo">Nuestras Líneas de atención</h2>
        <ul class="lineas">
          <li><img src="inicio/tel.png" alt="" width="40" height="40" />Teléfono: 604 495 39 04</li>
          <li>
            <img src="inicio/whatsapp.png" alt="" width="40" height="40" />WhatsApp: +57 310 841 58
            60
          </li>
          <li>
            <img src="inicio/correo.png" alt="" width="40" height="40" />Correo electrónico:
            patitas&#64;clinica.veterinaria.com
          </li>
          <li>
            <img src="inicio/ubicacion.png" alt="" width="40" height="40" />Dirección: Calle 35A
            #102 - 54
          </li>
        </ul>
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
    }
    .barra {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 40px;
      padding: 10px clamp(16px, 5vw, 80px);
      background: var(--color-encabezado);
    }
    .barra__logo img {
      display: block;
      width: 82px;
      height: auto;
    }
    .barra__menu {
      display: flex;
      gap: 32px;
      margin-left: auto;
      a {
        color: var(--color-marino);
        font-size: var(--texto-cuerpo);
        font-weight: 500;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    }
    .barra__acciones {
      display: flex;
      gap: 20px;
    }
    .portada {
      display: flex;
      flex-direction: column;
      gap: 72px;
      max-width: 1280px;
      margin: 0 auto;
      padding: 28px clamp(16px, 5vw, 80px) 64px;
    }
    .bloque {
      display: flex;
      flex-direction: column;
      gap: 24px;
      scroll-margin-top: 110px;
    }
    .portada__titulo {
      color: var(--color-primario);
      font-size: 40px;
      font-weight: 700;
    }
    .portada__lema {
      margin-top: -18px;
      font-size: 21px;
    }
    .portada__foto {
      width: 100%;
      height: auto;
      border-radius: 24px;
      object-fit: cover;
    }
    .portada__intro {
      font-size: 21px;
    }
    .portada__seccion {
      color: var(--color-primario);
      font-size: 30px;
      font-weight: 700;
    }
    .portada__seccion--centro {
      text-align: center;
    }
    .servicios {
      display: flex;
      flex-direction: column;
      gap: 40px;
    }
    .servicio {
      position: relative;
      display: flex;
      align-items: center;
      gap: 40px;
      min-height: 303px;
      padding-left: 85px;
      background: var(--color-encabezado);
      border-radius: var(--radio-tarjeta);
      &::before {
        content: '';
        position: absolute;
        top: calc(50% - 26px);
        left: 0;
        width: 85px;
        height: 52px;
        background: var(--color-marino);
      }
      img {
        width: 330px;
        height: 303px;
        border-radius: 22px;
        object-fit: cover;
      }
    }
    .servicio--derecha {
      flex-direction: row-reverse;
      padding: 0 85px;
      &::before {
        right: 0;
        left: auto;
      }
    }
    .servicio__texto {
      flex: 1;
      padding-right: 40px;
      h3 {
        color: var(--color-marino);
        font-size: 28px;
        font-weight: 600;
      }
      p {
        margin-top: 6px;
        font-size: 21px;
      }
    }
    .servicio--derecha .servicio__texto {
      padding-right: 0;
    }
    .nosotros {
      display: grid;
      grid-template-columns: 240px 1fr;
      align-items: center;
      gap: 40px;
      img {
        width: 240px;
        height: auto;
      }
      h3 {
        margin-bottom: 14px;
        color: var(--color-marino);
        font-size: 26px;
        font-weight: 600;
      }
      p {
        font-size: 21px;
      }
    }
    .pasos {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 34px;
      padding: 38px 0 34px;
      background: var(--color-primario-suave);
    }
    .paso {
      display: flex;
      flex-direction: column;
      gap: 40px;
      img {
        width: 100%;
        height: 248px;
        border-radius: 15px;
        object-fit: cover;
      }
    }
    .paso__caja {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 12px;
      color: var(--color-marino);
      font-size: 21px;
      text-align: center;
      background: var(--color-primario-suave);
      border: 2px solid var(--color-marino);
      border-radius: var(--radio-entrada);
      strong {
        font-size: 28px;
      }
    }
    .recordatorios {
      display: grid;
      grid-template-columns: 363px 1fr;
      align-items: center;
      gap: 80px;
      padding: 34px 34px 34px 46px;
      background: var(--color-encabezado);
      border-radius: var(--radio-tarjeta);
      img {
        width: 100%;
        height: auto;
        border-radius: 15px;
        background: #fff;
      }
      .paso__caja {
        background: var(--color-encabezado);
      }
    }
    .lineas__titulo {
      padding: 10px 6px;
      color: var(--color-primario);
      font-size: 30px;
      font-weight: 700;
      background: var(--color-primario-suave);
    }
    .lineas {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 40px 80px;
      margin: 0;
      padding: 0;
      list-style: none;
      li {
        display: flex;
        align-items: center;
        gap: 34px;
        font-size: 21px;
      }
      img {
        width: 56px;
        height: 56px;
        object-fit: contain;
      }
    }
    @media (max-width: 900px) {
      .servicio,
      .servicio--derecha {
        flex-direction: column;
        align-items: stretch;
        gap: 18px;
        padding: 18px;
        &::before {
          display: none;
        }
        img {
          width: 100%;
          height: 220px;
        }
      }
      .servicio__texto {
        padding: 0;
      }
      .pasos,
      .lineas,
      .nosotros,
      .recordatorios {
        grid-template-columns: 1fr;
        gap: 24px;
      }
      .pasos,
      .recordatorios {
        padding: 20px;
      }
      .nosotros img {
        width: 140px;
      }
    }
    @media (max-width: 640px) {
      .barra__menu {
        order: 3;
        width: 100%;
        justify-content: space-between;
        margin-left: 0;
      }
      .barra__acciones {
        margin-left: auto;
        gap: 10px;
      }
      .portada__titulo {
        font-size: 32px;
      }
      .portada__lema,
      .portada__intro,
      .servicio__texto p,
      .nosotros p,
      .paso__caja,
      .lineas li {
        font-size: var(--texto-cuerpo);
      }
    }
  `,
})
export default class Inicio {
  protected readonly servicios = SERVICIOS;
  protected readonly pasos = PASOS;
}
