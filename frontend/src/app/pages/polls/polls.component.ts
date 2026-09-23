import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { PollService } from '../../services/poll.service';
import { Poll } from '../../models/poll.model';

@Component({
  selector: 'app-polls',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './polls.component.html',
  styleUrl: './polls.component.css'
})
export class PollsComponent implements OnInit {

  polls: Poll[] = [];

  activeTab = 'active';

  searchText = '';
  selectedLocation = '';

  loading = false;

  constructor(
    private pollService: PollService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPolls();
  }

  loadPolls(): void {

    this.loading = true;

    if (this.activeTab === 'mine') {

      this.pollService.getMyPolls().subscribe({
        next: data => {
          this.polls = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });

      return;
    }

    if (this.activeTab === 'voted') {

      this.pollService.getVotedPolls().subscribe({
        next: data => {
          this.polls = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });

      return;
    }

    const status =
      this.activeTab === 'closed'
        ? 'closed'
        : 'active';

    this.pollService
      .getPolls(this.selectedLocation, status)
      .subscribe({
        next: data => {
          this.polls = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  changeTab(tab: string): void {
    this.activeTab = tab;
    this.loadPolls();
  }

  search(): void {
    this.loadPolls();
  }

  openPoll(id: number): void {
    this.router.navigate(['/polls', id]);
  }

  createPoll(): void {
    this.router.navigate(['/polls/create']);
  }

  get filteredPolls(): Poll[] {

    if (!this.searchText.trim()) {
      return this.polls;
    }

    const search =
      this.searchText.toLowerCase();

    return this.polls.filter(p =>
      p.title.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search) ||
      p.target_location.toLowerCase().includes(search)
    );
  }

  get totalVotes(): number {

    return this.polls.reduce(
      (total, poll) =>
        total + (poll.total_votes || poll.vote_count || 0),
      0
    );
  }
}
