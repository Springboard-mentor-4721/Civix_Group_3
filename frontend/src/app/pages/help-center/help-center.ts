import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../auth/auth';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './help-center.html',
  styleUrl: '../pages.css'
})
export class HelpCenter {
  searchQuery: string = '';
  activeCategory: string = 'all';
  openFaq: number | null = null;

  faqs: FaqItem[] = [
    {
      category: 'account',
      question: 'How do I create a Citizen or Official account?',
      answer: 'Click Register on the homepage. Choose Citizen to sign petitions and vote on local polls, or Official if you are an authorized government or municipal department representative. Official accounts undergo administrative verification.'
    },
    {
      category: 'account',
      question: 'How does location detection work?',
      answer: 'When you click Auto-Detect on registration or petition creation, CIVIX uses your browser geolocation API to lookup your municipal locality and city, ensuring accurate local representation.'
    },
    {
      category: 'account',
      question: 'I forgot my password. How do I reset it?',
      answer: 'Click Forgot password on the Sign In page, enter your registered email address, and you will receive a secure password reset token link.'
    },
    {
      category: 'petitions',
      question: 'How do I start a neighborhood petition?',
      answer: 'From your Dashboard, navigate to the Petitions section and click Start a Petition. Provide a clear title, category, target locality, signature goal, and detailed proposal.'
    },
    {
      category: 'petitions',
      question: 'Who can sign my petition?',
      answer: 'Any registered citizen in the platform can sign active petitions. Each citizen can sign a petition once.'
    },
    {
      category: 'petitions',
      question: 'What happens when a petition reaches its signature goal?',
      answer: 'When the target goal is met, the petition status automatically transitions to Under Review, notifying designated municipal officials for formal council consideration.'
    },
    {
      category: 'officials',
      question: 'How do officials respond to constituent petitions?',
      answer: 'Verified officials have an Official Action Panel on petition pages where they can update status (Active, Under Review, Closed) and post administrative resolutions.'
    },
    {
      category: 'security',
      question: 'How is constituent data protected?',
      answer: 'CIVIX employs JWT Bearer token authentication, native bcrypt hashing, strict SSL transport encryption, and granular role-based access controls.'
    }
  ];

  constructor(private auth: Auth) {}

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }

  setCategory(cat: string) {
    this.activeCategory = cat;
    this.openFaq = null;
  }

  toggleFaq(index: number) {
    this.openFaq = this.openFaq === index ? null : index;
  }

  get filteredFaqs(): FaqItem[] {
    return this.faqs.filter((faq) => {
      const matchCat = this.activeCategory === 'all' || faq.category === this.activeCategory;
      const q = this.searchQuery.toLowerCase().trim();
      const matchSearch = !q || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }
}
