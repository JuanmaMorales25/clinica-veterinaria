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
      enConstruccion('pacientes', 'Buscar paciente'),
      enConstruccion('pacientes/:mascotaId', 'Ficha del paciente'),
      enConstruccion('consultas/:consultaId', 'Registrar consulta'),
      enConstruccion('facturacion/:consultaId', 'Facturación'),
      enConstruccion('citas', 'Citas por confirmar'),
    ],
  },

  { path: '**', redirectTo: '' },
];
