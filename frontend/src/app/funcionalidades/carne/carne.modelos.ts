export interface AlergiaCarnet {
  descripcion: string;
  severidad: string;
}

export interface VacunaCarnet {
  biologico: string;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string | null;
}

export interface CarnetMascota {
  id: string;
  nombre: string;
  especie: string;
  raza: string | null;
  edad: string | null;
  numero_historia: string;
  alergias: AlergiaCarnet[];
  vacunas: VacunaCarnet[];
  proximas_dosis: VacunaCarnet[];
}

export interface EnlaceCarne {
  enlace: string;
}
