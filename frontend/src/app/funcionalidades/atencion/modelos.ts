export type EstadoConsulta = 'ABIERTA' | 'CERRADA';

export interface Alergia {
  descripcion: string;
  severidad: string;
}

export interface ResumenMascota {
  id: string;
  nombre: string;
  especie: string;
  raza: string | null;
  edad: string | null;
  numero_historia: string;
  fotografia: string | null;
  alergias: Alergia[];
  esquema_al_dia: boolean;
  ultima_atencion: string | null;
  propietario_nombre: string;
  propietario_telefono: string;
}

export interface VacunaFicha {
  biologico: string;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string | null;
  refuerzo_programado: boolean;
}

export interface AtencionFicha {
  id: string;
  fecha: string;
  motivo: string;
  veterinario: string;
  estado: EstadoConsulta;
}

export interface FichaPaciente extends ResumenMascota {
  vacunas: VacunaFicha[];
  atenciones: AtencionFicha[];
  consulta_abierta_id: string | null;
}

export interface DatosConsulta {
  motivo: string;
  peso: number | null;
  temperatura: number | null;
  frecuencia_cardiaca: number | null;
  hallazgos: string | null;
  diagnostico: string | null;
  plan_tratamiento: string | null;
}

export interface Prescripcion {
  id: string;
  producto_id: string;
  producto: string;
  cantidad: number;
  dosis: string | null;
  via_administracion: string | null;
  frecuencia: string | null;
  duracion: string | null;
  alerta_revisada: boolean;
  motivo_omision_alerta: string | null;
}

export interface Vacunacion {
  id: string;
  esquema_id: string;
  biologico: string;
  laboratorio: string | null;
  lote_id: string;
  lote_codigo: string;
  lote_vence: string;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string | null;
  fecha_aviso: string | null;
}

export interface Nota {
  id: string;
  texto: string;
  autor: string;
  fecha: string;
}

export interface ConsultaDetalle extends DatosConsulta {
  id: string;
  estado: EstadoConsulta;
  fecha: string;
  cerrada_en: string | null;
  veterinario: string;
  mascota: ResumenMascota;
  servicios: string[];
  prescripciones: Prescripcion[];
  vacunaciones: Vacunacion[];
  notas: Nota[];
  factura: { id: string; numero: string; estado: string } | null;
}

export interface Medicamento {
  id: string;
  nombre: string;
  principio_activo: string | null;
}

export interface SolicitudPrescripcion {
  producto_id: string;
  cantidad: number;
  dosis: string | null;
  via_administracion: string | null;
  frecuencia: string | null;
  duracion: string | null;
  alerta_revisada: boolean;
  motivo_omision_alerta: string | null;
}

export interface LoteDisponible {
  id: string;
  codigo: string;
  fecha_vencimiento: string;
  disponible: number;
}

export interface OpcionVacuna {
  esquema_id: string;
  biologico: string;
  laboratorio: string | null;
  numero_dosis: number;
  intervalo_dias: number;
  lotes: LoteDisponible[];
}

export interface OpcionesVacunacion {
  dias_aviso: number;
  opciones: OpcionVacuna[];
}

export interface RegistroAlerta {
  decision: 'REVISADA' | 'OMITIDA';
  motivo: string | null;
  usuario: string;
  fecha: string;
}
