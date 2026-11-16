import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Comprobante, CuentaDeCobro, MedioPago } from './modelos';

@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/facturacion`;

  cuenta(idConsulta: string): Observable<CuentaDeCobro> {
    return this.http.get<CuentaDeCobro>(`${this.url}/consultas/${idConsulta}/cuenta`);
  }

  ajustarLinea(
    idConsulta: string,
    idLinea: string,
    cambios: { lote_id?: string; cantidad?: number },
  ): Observable<CuentaDeCobro> {
    return this.http.put<CuentaDeCobro>(
      `${this.url}/consultas/${idConsulta}/lineas/${idLinea}`,
      cambios,
    );
  }

  registrarEntrada(idLote: string, cantidad: number): Observable<{ disponible: number }> {
    return this.http.post<{ disponible: number }>(
      `${environment.apiUrl}/inventario/lotes/${idLote}/entradas`,
      { cantidad },
    );
  }

  facturar(
    idConsulta: string,
    pago: { medio: MedioPago; valor_recibido: number | null; simular_falla: boolean },
  ): Observable<Comprobante> {
    return this.http.post<Comprobante>(`${this.url}/consultas/${idConsulta}/facturar`, pago);
  }

  factura(idConsulta: string): Observable<Comprobante> {
    return this.http.get<Comprobante>(`${this.url}/consultas/${idConsulta}/factura`);
  }

  anular(idFactura: string, motivo: string): Observable<Comprobante> {
    return this.http.post<Comprobante>(`${this.url}/facturas/${idFactura}/anular`, { motivo });
  }

  pdf(idFactura: string): Observable<Blob> {
    return this.http.get(`${this.url}/facturas/${idFactura}/pdf`, { responseType: 'blob' });
  }

  enviar(idFactura: string): Observable<{ destinatario: string }> {
    return this.http.post<{ destinatario: string }>(`${this.url}/facturas/${idFactura}/enviar`, {});
  }
}
