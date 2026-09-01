import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  userName: string = '';
  userLocation: string = '';
  userRole: string = '';
  userEmail: string = '';

  categories: string[] = ['All Categories', 'Environment', 'Infrastructure', 'Education', 'Public Safety', 'Transportation', 'Healthcare', 'Housing'];
  selectedCategory: string = 'All Categories';

  constructor(private router: Router) {}

  ngOnInit() {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      this.userName = user.name;
      this.userLocation = user.location;
      this.userRole = user.role;
      this.userEmail = user.email;
    } else {
      this.router.navigate(['/login']);
    }
  }

  selectCategory(cat: string) {
    this.selectedCategory = cat;
  }

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}