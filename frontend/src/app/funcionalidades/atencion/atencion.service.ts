import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ConsultaDetalle,
  DatosConsulta,
  FichaPaciente,
  Medicamento,
  Nota,
  OpcionesVacunacion,
  Prescripcion,
  RegistroAlerta,
  ResumenMascota,
  SolicitudPrescripcion,
  Vacunacion,
} from './modelos';

@Injectable({ providedIn: 'root' })
export class AtencionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/atencion`;

  buscarPacientes(texto: string): Observable<ResumenMascota[]> {
    return this.http.get<ResumenMascota[]>(`${this.url}/pacientes`, {
      params: new HttpParams().set('q', texto),
    });
  }

  ficha(idMascota: string): Observable<FichaPaciente> {
    return this.http.get<FichaPaciente>(`${this.url}/pacientes/${idMascota}`);
  }

  iniciarConsulta(idMascota: string): Observable<ConsultaDetalle> {
    return this.http.post<ConsultaDetalle>(`${this.url}/consultas`, { mascota_id: idMascota });
  }

  consulta(idConsulta: string): Observable<ConsultaDetalle> {
    return this.http.get<ConsultaDetalle>(`${this.url}/consultas/${idConsulta}`);
  }

  guardarConsulta(idConsulta: string, datos: DatosConsulta): Observable<ConsultaDetalle> {
    return this.http.put<ConsultaDetalle>(`${this.url}/consultas/${idConsulta}`, datos);
  }

  medicamentos(): Observable<Medicamento[]> {
    return this.http.get<Medicamento[]>(`${this.url}/medicamentos`);
  }

  registrarAlerta(
    idConsulta: string,
    decision: 'REVISADA' | 'OMITIDA',
    motivo: string | null = null,
  ): Observable<RegistroAlerta> {
    return this.http.post<RegistroAlerta>(`${this.url}/consultas/${idConsulta}/alerta-alergia`, {
      decision,
      motivo,
    });
  }

  prescribir(idConsulta: string, datos: SolicitudPrescripcion): Observable<Prescripcion> {
    return this.http.post<Prescripcion>(
      `${this.url}/consultas/${idConsulta}/prescripciones`,
      datos,
    );
  }

  quitarPrescripcion(idConsulta: string, idItem: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/consultas/${idConsulta}/prescripciones/${idItem}`);
  }

  opcionesVacunacion(idConsulta: string): Observable<OpcionesVacunacion> {
    return this.http.get<OpcionesVacunacion>(`${this.url}/consultas/${idConsulta}/vacunacion`);
  }

  registrarVacunacion(
    idConsulta: string,
    datos: { esquema_id: string; lote_id: string; fecha_aplicacion: string | null },
  ): Observable<Vacunacion> {
    return this.http.post<Vacunacion>(`${this.url}/consultas/${idConsulta}/vacunaciones`, datos);
  }

  cerrar(idConsulta: string): Observable<ConsultaDetalle> {
    return this.http.post<ConsultaDetalle>(`${this.url}/consultas/${idConsulta}/cerrar`, {});
  }

  agregarNota(idConsulta: string, texto: string): Observable<Nota> {
    return this.http.post<Nota>(`${this.url}/consultas/${idConsulta}/notas`, { texto });
  }
}
