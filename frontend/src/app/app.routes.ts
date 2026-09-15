import { Routes } from '@angular/router';

import { PollsComponent } from './pages/polls/polls.component';
import { CreatePollComponent } from './pages/polls/create-poll/create-poll.component';
import { PollDetailComponent } from './pages/polls/poll-detail/poll-detail.component';

export const routes: Routes = [

  {
    path: 'polls',
    component: PollsComponent
  },

  {
    path: 'polls/create',
    component: CreatePollComponent
  },

  {
    path: 'polls/:id',
    component: PollDetailComponent
  }

];
