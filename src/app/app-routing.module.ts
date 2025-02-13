import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CardsComponent } from './cards/cards.component';
import { PlayComponent } from './play/play.component';

const routes: Routes = [{
  path: 'cards',
  component: CardsComponent,
},
{
  path: 'play',
  component: PlayComponent
}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
