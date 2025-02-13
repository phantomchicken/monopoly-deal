import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Card } from 'src/app/classes/card';


@Injectable({
  providedIn: 'root'
})
export class CardService {

  constructor(private http: HttpClient) {}
  private apiUrl = environment.apiUrl; 
    public getCards(): Promise<Card[]>{
      const url = `${this.apiUrl}/cards`;
      return this.http.get(url)
        .toPromise()
        .then(response => response as Card[])
        .catch(this.processError);
    }

    private processError(error: any): Promise<any> {
      return Promise.reject(error.error.message || error);
    }
}
