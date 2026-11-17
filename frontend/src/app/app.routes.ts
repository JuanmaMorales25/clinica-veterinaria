import { Route, Routes } from '@angular/router';

import { requiereRol } from './core/autenticacion/guardias';
import { ROLES_PERSONAL } from './core/autenticacion/modelos';

/** Ruta temporal mientras se construye la pantalla real. */
function enConstruccion(path: string, titulo: string): Route {
  return {
    path,
    title: `${titulo} · Clínica Veterinaria`,
    data: { titulo },
    loadComponent: () => import('./compartido/pagina-en-construccion/pagina-en-construccion'),
  };
}

export const routes: Routes = [
  {
    path: '',
    title: 'Clínica Veterinaria',
    loadComponent: () => import('./funcionalidades/acceso/inicio/inicio'),
  },

  // Acceso
  {
    path: 'acceso/iniciar-sesion',
    title: 'Iniciar sesión · Clínica Veterinaria',
    loadComponent: () => import('./funcionalidades/acceso/iniciar-sesion/iniciar-sesion'),
  },
  {
    path: 'acceso/registro',
    title: 'Crear cuenta · Clínica Veterinaria',
    loadComponent: () => import('./funcionalidades/acceso/registro/registro'),
  },
  {
    path: 'acceso/recuperar',
    title: 'Recuperar acceso · Clínica Veterinaria',
    loadComponent: () => import('./funcionalidades/acceso/recuperar/recuperar'),
  },
  {
    path: 'acceso/restablecer',
    title: 'Nueva contraseña · Clínica Veterinaria',
    loadComponent: () => import('./funcionalidades/acceso/restablecer/restablecer'),
  },
  {
    path: 'acceso/sesion-expirada',
    title: 'Sesión expirada · Clínica Veterinaria',
    loadComponent: () => import('./funcionalidades/acceso/sesion-expirada/sesion-expirada'),
  },

  // Carné digital abierto desde el código QR (sin sesión)
  {
    path: 'carne/:token',
    title: 'Carné digital · Clínica Veterinaria',
    loadComponent: () => import('./funcionalidades/carne/carne-digital/carne-digital'),
  },

  // Portal del propietario
  {
    path: 'propietario',
    canActivate: [requiereRol('PROPIETARIO')],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Mis mascotas · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/agenda/mascotas/mascotas'),
      },
      {
        path: 'agendar',
        children: [
          {
            path: '',
            title: 'Agenda tu cita · Clínica Veterinaria',
            loadComponent: () => import('./funcionalidades/agenda/agendar-mascota/agendar-mascota'),
          },
          {
            path: 'servicio/:mascotaId',
            title: 'Elige el servicio · Clínica Veterinaria',
            loadComponent: () => import('./funcionalidades/agenda/agendar-servicio/agendar-servicio'),
          },
          {
            path: 'horario/:mascotaId/:servicioId',
            title: 'Elige fecha y hora · Clínica Veterinaria',
            loadComponent: () => import('./funcionalidades/agenda/agendar-horario/agendar-horario'),
          },
          {
            path: 'enviada',
            title: 'Solicitud enviada · Clínica Veterinaria',
            loadComponent: () => import('./funcionalidades/agenda/solicitud-enviada/solicitud-enviada'),
          },
        ],
      },
      {
        path: 'carne/:mascotaId',
        title: 'Carné digital · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/carne/carne-digital/carne-digital'),
      },
      {
        path: 'preferencias',
        title: 'Preferencias de notificación · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/notificaciones/preferencias/preferencias'),
      },
    ],
  },

  // Personal de la clínica
  {
    path: 'personal',
    canActivate: [requiereRol(...ROLES_PERSONAL)],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pacientes' },
      {
        path: 'pacientes',
        title: 'Buscar paciente · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/atencion/buscar-paciente/buscar-paciente'),
      },
      {
        path: 'pacientes/:mascotaId',
        title: 'Ficha del paciente · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/atencion/ficha-paciente/ficha-paciente'),
      },
      {
        path: 'consultas/:consultaId',
        title: 'Registrar consulta · Clínica Veterinaria',
        loadComponent: () =>
          import('./funcionalidades/atencion/registrar-consulta/registrar-consulta'),
      },
      {
        path: 'consultas/:consultaId/prescripcion',
        title: 'Prescripción · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/atencion/prescripcion/prescripcion'),
      },
      {
        path: 'consultas/:consultaId/vacunacion',
        title: 'Registrar vacunación · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/atencion/vacunacion/vacunacion'),
      },
      {
        path: 'consultas/:consultaId/registro',
        title: 'Historia clínica · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/atencion/registro-clinico/registro-clinico'),
      },
      enConstruccion('facturacion/:consultaId', 'Facturación'),
      {
        path: 'citas',
        title: 'Citas por confirmar · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/agenda/citas-pendientes/citas-pendientes'),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
