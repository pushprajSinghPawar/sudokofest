import { Routes } from '@angular/router';
import { LinkCreatorComponent } from './link-creator.component';
import { LobbyComponent } from './lobby.component';
import { ResultsComponent } from './results.component';
import { SudokuGameComponent } from './sudoku-game.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: LinkCreatorComponent,
  },
  {
    path: 'game/:sessionId',
    component: SudokuGameComponent,
  },
  {
    path: 'lobby/:sessionId',
    component: LobbyComponent,
  },
  {
    path: 'results/:sessionId',
    component: ResultsComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
