import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Card } from 'src/app/classes/card';
import { Observable, of } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class CardService {

  constructor(private http: HttpClient) {}

  private staticCards: Card[] = require('../assets/cards.json');

  public getCards(): Observable<Card[]> {
    if (environment.useStaticCards) {
      return of(this.staticCards);
    }

    return this.http.get<Card[]>(`${environment.apiUrl}/cards`);
  }
}
