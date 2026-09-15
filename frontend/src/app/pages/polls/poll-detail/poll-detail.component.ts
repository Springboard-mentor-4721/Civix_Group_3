import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { PollService } from '../../../services/poll.service';
import { Poll } from '../../../models/poll.model';

@Component({
  selector: 'app-poll-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './poll-detail.component.html',
  styleUrl: './poll-detail.component.css'
})
export class PollDetailComponent implements OnInit {

  poll?: Poll;

  selectedOption = '';

  loading = true;
  submitting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pollService: PollService
  ) {}

  ngOnInit(): void {

    const id =
      Number(this.route.snapshot.paramMap.get('id'));

    this.loadPoll(id);
  }

  loadPoll(id: number): void {

    this.loading = true;

    this.pollService.getPoll(id).subscribe({

      next: poll => {
        this.poll = poll;

        if (poll.my_selected_option) {
          this.selectedOption =
            poll.my_selected_option;
        }

        this.loading = false;
      },

      error: () => {
        this.loading = false;
      }

    });
  }

  submitVote(): void {

    if (!this.poll || !this.selectedOption) {
      return;
    }

    this.submitting = true;

    this.pollService
      .vote(this.poll.id, this.selectedOption)
      .subscribe({

        next: updatedPoll => {

          this.poll = updatedPoll;

          this.submitting = false;

          alert('Your vote has been submitted.');

        },

        error: error => {

          this.submitting = false;

          if (error.status === 409) {
            alert('You have already voted on this poll.');
          } else {
            alert(
              error?.error?.message ||
              'Unable to submit vote.'
            );
          }

          this.loadPoll(this.poll!.id);
        }

      });
  }

  changeVote(): void {

    if (!this.poll || !this.selectedOption) {
      return;
    }

    this.submitting = true;

    this.pollService
      .changeVote(
        this.poll.id,
        this.selectedOption
      )
      .subscribe({

        next: updatedPoll => {

          this.poll = updatedPoll;

          this.submitting = false;

          alert('Your vote has been updated.');

        },

        error: () => {

          this.submitting = false;

        }

      });
  }

  withdrawVote(): void {

    if (!this.poll) {
      return;
    }

    const confirmed =
      confirm('Remove your vote from this poll?');

    if (!confirmed) {
      return;
    }

    this.pollService
      .withdrawVote(this.poll.id)
      .subscribe({

        next: updatedPoll => {

          this.poll = updatedPoll;

          this.selectedOption = '';

          alert('Your vote has been removed.');

        }

      });
  }

  back(): void {
    this.router.navigate(['/polls']);
  }

  refresh(): void {

    if (this.poll) {
      this.loadPoll(this.poll.id);
    }

  }
}
