import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { PollService } from '../../../services/poll.service';

@Component({
  selector: 'app-create-poll',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './create-poll.component.html',
  styleUrl: './create-poll.component.css'
})
export class CreatePollComponent {

  title = '';
  description = '';

  targetLocation = '';

  closesOn = '';

  options: string[] = [
    '',
    ''
  ];

  submitting = false;

  errorMessage = '';

  constructor(
    private pollService: PollService,
    private router: Router
  ) {}

  addOption(): void {

    if (this.options.length < 10) {
      this.options.push('');
    }
  }

  removeOption(index: number): void {

    if (this.options.length > 2) {
      this.options.splice(index, 1);
    }
  }

  createPoll(): void {

    this.errorMessage = '';

    const validOptions =
      this.options
        .map(option => option.trim())
        .filter(option => option.length > 0);

    if (!this.title.trim()) {
      this.errorMessage = 'Poll title is required.';
      return;
    }

    if (!this.description.trim()) {
      this.errorMessage = 'Description is required.';
      return;
    }

    if (validOptions.length < 2) {
      this.errorMessage = 'Please provide at least 2 options.';
      return;
    }

    if (!this.targetLocation.trim()) {
      this.errorMessage = 'Target location is required.';
      return;
    }

    if (!this.closesOn) {
      this.errorMessage = 'Closing date is required.';
      return;
    }

    const selectedDate =
      new Date(this.closesOn);

    const today =
      new Date();

    const maxDate =
      new Date();

    maxDate.setDate(
      today.getDate() + 30
    );

    if (selectedDate > maxDate) {
      this.errorMessage =
        'Closing date cannot be more than 30 days from today.';
      return;
    }

    const data = {
      title: this.title.trim(),
      description: this.description.trim(),
      options: validOptions,
      target_location: this.targetLocation.trim(),
      closes_on: this.closesOn
    };

    this.submitting = true;

    this.pollService.createPoll(data).subscribe({

      next: poll => {

        this.submitting = false;

        alert('Poll created successfully!');

        this.router.navigate([
          '/polls',
          poll.id
        ]);

      },

      error: error => {

        this.submitting = false;

        this.errorMessage =
          error?.error?.message ||
          'Unable to create poll. Please try again.';
      }

    });
  }

  cancel(): void {
    this.router.navigate(['/polls']);
  }
}
