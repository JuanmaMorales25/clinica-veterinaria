import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CitaAgendada,
  HorarioDisponible,
  MascotaAgendada,
  ServicioAgendado,
} from './agenda.modelos';

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/agenda`;

  mascotas(): Observable<MascotaAgendada[]> {
    return this.http.get<MascotaAgendada[]>(`${this.url}/mascotas`);
  }

  vincularMascota(numeroHistoria: string): Observable<MascotaAgendada> {
    return this.http.post<MascotaAgendada>(`${this.url}/mascotas/vincular`, {
      numero_historia: numeroHistoria,
    });
  }

  servicios(): Observable<ServicioAgendado[]> {
    return this.http.get<ServicioAgendado[]>(`${this.url}/servicios`);
  }

  horarios(dia: string, servicioId: string): Observable<HorarioDisponible[]> {
    const params = new HttpParams().set('dia', dia).set('servicio_id', servicioId);
    return this.http.get<HorarioDisponible[]>(`${this.url}/horarios`, { params });
  }

  solicitarCita(datos: {
    mascota_id: string;
    servicio_id: string;
    fecha_hora: string;
    veterinario_id: string;
  }): Observable<CitaAgendada> {
    return this.http.post<CitaAgendada>(`${this.url}/citas`, datos);
  }

  citasPendientes(): Observable<CitaAgendada[]> {
    return this.http.get<CitaAgendada[]>(`${this.url}/citas/pendientes`);
  }

  confirmarCita(id: string): Observable<CitaAgendada> {
    return this.http.post<CitaAgendada>(`${this.url}/citas/${id}/confirmar`, {});
  }

  cancelarCita(id: string, motivo: string): Observable<CitaAgendada> {
    return this.http.post<CitaAgendada>(`${this.url}/citas/${id}/cancelar`, { motivo });
  }
}
