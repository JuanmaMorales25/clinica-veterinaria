export interface MascotaAgendada {
  id: string;
  nombre: string;
  especie: string;
  raza: string | null;
  numero_historia: string;
}

export interface ServicioAgendado {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_estimada: number;
  precio: number;
}

export interface HorarioDisponible {
  fecha_hora: string;
  veterinario_id: string;
  veterinario: string;
}

export type EstadoCita = 'PENDIENTE' | 'CONFIRMADA' | 'ATENDIDA' | 'CANCELADA' | 'NO_ASISTIDA';

export interface CitaAgendada {
  id: string;
  mascota_id: string;
  mascota: string;
  servicio: string;
  veterinario: string | null;
  fecha_hora: string;
  estado: EstadoCita;
  motivo_cancelacion: string | null;
}
