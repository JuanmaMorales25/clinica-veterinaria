import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CarnetMascota, EnlaceCarne } from './carne.modelos';

@Injectable({ providedIn: 'root' })
export class CarneService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/carne`;

  privado(mascotaId: string): Observable<CarnetMascota> {
    return this.http.get<CarnetMascota>(`${this.url}/mascotas/${mascotaId}`);
  }

  publico(token: string): Observable<CarnetMascota> {
    return this.http.get<CarnetMascota>(`${this.url}/enlace/${encodeURIComponent(token)}`);
  }

  crearEnlace(mascotaId: string): Observable<EnlaceCarne> {
    return this.http.post<EnlaceCarne>(`${this.url}/mascotas/${mascotaId}/enlace`, {});
  }
}
