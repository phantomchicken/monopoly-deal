import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CardsComponent } from './cards/cards.component';
import { PlayComponent } from './play/play.component';
import { RulesComponent } from './rules/rules.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/play',
    pathMatch: 'full'
  },
  {
    path: 'play',
    component: PlayComponent
  },
  {
    path: 'cards',
    component: CardsComponent
  },
  {
    path: 'rules',
    component: RulesComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { 
    scrollPositionRestoration: 'top', 
    anchorScrolling: 'enabled' 
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
