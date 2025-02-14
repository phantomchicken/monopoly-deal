import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Card } from 'src/app/classes/card';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class CardService {

  constructor(private http: HttpClient) {}
  private apiUrl = environment.apiUrl; 
    public getCards(): Observable<Card[]>{
      const url = `${this.apiUrl}/cards`;
      return this.http.get<Card[]>(`${this.apiUrl}/cards`);
    }

    private processError(error: any): Promise<any> {
      return Promise.reject(error.error.message || error);
    }
}
