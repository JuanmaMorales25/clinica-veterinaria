import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Rol } from './modelos';
import { SesionService } from './sesion.service';

export function requiereRol(...roles: Rol[]): CanActivateFn {
  return () => {
    const sesion = inject(SesionService);
    const router = inject(Router);
    const usuario = sesion.usuario();

    if (!sesion.autenticado() || usuario === null) {
      return router.createUrlTree(['/acceso/iniciar-sesion']);
    }
    return roles.includes(usuario.rol) || router.createUrlTree([sesion.rutaInicio()]);
  };
}
