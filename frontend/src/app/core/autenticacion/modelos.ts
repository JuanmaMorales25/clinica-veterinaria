export type Rol = 'ADMINISTRADOR' | 'VETERINARIO' | 'AUXILIAR' | 'PROPIETARIO';

export const ROLES_PERSONAL: Rol[] = ['ADMINISTRADOR', 'VETERINARIO', 'AUXILIAR'];

export interface Usuario {
  id: string;
  nombre: string;
  correo_electronico: string;
  rol: Rol;
}

export interface RespuestaLogin {
  token: string;
  usuario: Usuario;
}

export interface SolicitudRegistro {
  nombre: string;
  correo: string;
  contrasena: string;
  documento_identidad: string;
  telefono: string;
  autorizacion_datos: boolean;
}

export interface RespuestaMensaje {
  mensaje: string;
}
