import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../auth';

type Step = 'email' | 'camera' | 'preview' | 'uploading' | 'done' | 'error';

@Component({
  selector: 'app-face-verification',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './face-verification.html',
  styleUrl: './face-verification.css'
})
export class FaceVerification implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  step: Step = 'email';
  email = '';
  capturedImage = '';
  errorMessage = '';
  successMessage = '';
  private stream: MediaStream | null = null;
  private _startCameraOnInit = false;

  constructor(
    private authService: Auth,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const pending = localStorage.getItem('civix_pending_email');
    if (pending) {
      this.email = pending;
      this.step = 'camera';
      this._startCameraOnInit = true;
    }
  }

  ngAfterViewInit() {
    if (this._startCameraOnInit) {
      setTimeout(() => this.startCamera(), 200);
    }
  }

  ngOnDestroy() { this.stopCamera(); }

  submitEmail() {
    const e = this.email.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      this.errorMessage = 'Please enter a valid email address.';
      return;
    }
    this.errorMessage = '';
    localStorage.setItem('civix_pending_email', e);
    this.step = 'camera';
    this.cdr.detectChanges();
    setTimeout(() => this.startCamera(), 200);
  }

  startCamera() {
    this.errorMessage = '';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then(stream => {
        this.stream = stream;
        if (this.videoEl?.nativeElement) {
          this.videoEl.nativeElement.srcObject = stream;
        }
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.errorMessage = 'Camera access denied. Please allow camera access and try again.';
        this.cdr.detectChanges();
      });
  }

  capturePhoto() {
    const video  = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.capturedImage = canvas.toDataURL('image/jpeg', 0.85);
    this.stopCamera();
    this.step = 'preview';
    this.cdr.detectChanges();
  }

  retake() {
    this.capturedImage = '';
    this.step = 'camera';
    this.cdr.detectChanges();
    setTimeout(() => this.startCamera(), 200);
  }

  confirmPhoto() {
    if (!this.capturedImage || !this.email) return;
    this.step = 'uploading';
    this.errorMessage = '';

    this.authService.faceVerification(this.email, this.capturedImage).subscribe({
      next: (res) => {
        this.step = 'done';
        this.successMessage = res.message || 'Face verification complete! Registration successful.';
        localStorage.removeItem('civix_pending_email');
        this.cdr.detectChanges();
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        this.step = 'error';
        const detail = err.error?.detail;
        this.errorMessage = typeof detail === 'object' ? detail?.message : (detail || 'Face verification failed. Please try again.');
        this.cdr.detectChanges();
      }
    });
  }

  private stopCamera() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }
}
