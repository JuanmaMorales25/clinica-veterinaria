export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA';
export type EstadoLinea = 'SERVICIO' | 'VIGENTE' | 'VENCIDO' | 'INSUFICIENTE' | 'SIN_LOTE';

export interface PacienteFacturacion {
  id: string;
  nombre: string;
  especie: string;
  edad: string | null;
  numero_historia: string;
  fotografia: string | null;
}

export interface OpcionLote {
  id: string;
  codigo: string;
  fecha_vencimiento: string;
  disponible: number;
  vencido: boolean;
}

export interface LineaCuenta {
  id: string;
  origen: 'SERVICIO' | 'VACUNA' | 'PRESCRIPCION';
  tipo: 'SERVICIO' | 'PRODUCTO';
  descripcion: string;
  lote_id: string | null;
  lote_codigo: string | null;
  lote_vence: string | null;
  disponible: number | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  estado: EstadoLinea;
  editable: boolean;
  lotes: OpcionLote[];
}

export interface DetalleComprobante {
  descripcion: string;
  lote: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Comprobante {
  id: string;
  numero: string;
  estado: 'EMITIDA' | 'ANULADA';
  consulta_id: string;
  emitida_en: string;
  total: number;
  medio: MedioPago | null;
  valor_recibido: number | null;
  cambio: number | null;
  propietario: string;
  correo_propietario: string;
  paciente: PacienteFacturacion;
  fecha_atencion: string;
  servicio_principal: string | null;
  detalles: DetalleComprobante[];
  anulada_en: string | null;
  anulada_por: string | null;
  motivo_anulacion: string | null;
}

export interface CuentaDeCobro {
  consulta_id: string;
  fecha_atencion: string;
  servicio_principal: string | null;
  paciente: PacienteFacturacion;
  lineas: LineaCuenta[];
  total: number;
  bloqueada: boolean;
  factura: Comprobante | null;
}

/** Detalle que acompaña a LOTE_VENCIDO (D1) y EXISTENCIA_INSUFICIENTE (D2). */
export interface DetalleConflicto {
  producto: string;
  lote: string | null;
  lote_id?: string;
  fecha_vencimiento?: string;
  cantidad?: number;
  disponible?: number;
  solicitado?: number;
  lote_sugerido?: {
    id: string;
    codigo: string;
    fecha_vencimiento: string;
    disponible: number;
  } | null;
}
