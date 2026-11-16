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
  enConstruccion('', 'Clínica Veterinaria'),

  // Acceso
  {
    path: 'acceso/iniciar-sesion',
    title: 'Iniciar sesión · Clínica Veterinaria',
    loadComponent: () => import('./funcionalidades/acceso/iniciar-sesion/iniciar-sesion'),
  },
  enConstruccion('acceso/registro', 'Registrarse'),
  enConstruccion('acceso/recuperar', 'Recupera tu acceso'),
  enConstruccion('acceso/sesion-expirada', 'Sesión expirada'),

  // Carné digital abierto desde el código QR (sin sesión)
  enConstruccion('carne/:token', 'Carné digital'),

  // Portal del propietario
  {
    path: 'propietario',
    canActivate: [requiereRol('PROPIETARIO')],
    children: [
      enConstruccion('', 'Mis mascotas'),
      enConstruccion('agendar', 'Agenda tu cita'),
      enConstruccion('carne/:mascotaId', 'Carné digital'),
      enConstruccion('preferencias', 'Preferencias de notificación'),
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
      {
        path: 'facturacion/:consultaId',
        title: 'Cuenta de cobro · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/facturacion/cuenta-cobro/cuenta-cobro'),
      },
      {
        path: 'facturacion/:consultaId/pago',
        title: 'Registrar pago · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/facturacion/registrar-pago/registrar-pago'),
      },
      {
        path: 'facturacion/:consultaId/comprobante',
        title: 'Comprobante · Clínica Veterinaria',
        loadComponent: () => import('./funcionalidades/facturacion/comprobante/comprobante'),
      },
      enConstruccion('citas', 'Citas por confirmar'),
    ],
  },

  { path: '**', redirectTo: '' },
];
